import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import DiningReservation from './models/DiningReservation';
import ExperienceBooking from './models/ExperienceBooking';
import Settings from './models/Settings';
import { ReservationRuleError } from './reservation-capacity';
import {
  reservationPaymentSummary,
  type ReservationReceipt,
} from './reservation-payment-state';

type Kind = 'dining' | 'experience';
const modelFor = (kind: Kind) =>
  kind === 'dining' ? DiningReservation : ExperienceBooking;
export interface ReservationStripeGateway {
  checkout: {
    sessions: {
      retrieve(
        id: string
      ): Promise<{ status: string | null; url: string | null }>;
      create(
        params: {
          mode: 'payment';
          payment_method_types: ['card'];
          line_items: {
            price_data: {
              currency: string;
              unit_amount: number;
              product_data: { name: string };
            };
            quantity: number;
          }[];
          metadata: Record<string, string>;
          payment_intent_data: { metadata: Record<string, string> };
          success_url: string;
          cancel_url: string;
        },
        options: { idempotencyKey: string }
      ): Promise<{ id: string; url: string | null }>;
    };
  };
  refunds: {
    create(
      params: {
        payment_intent: string;
        amount: number;
        metadata: Record<string, string>;
      },
      options: { idempotencyKey: string }
    ): Promise<{ id: string; status: string | null }>;
    retrieve(id: string): Promise<{ id: string; status: string | null }>;
  };
}
export async function createReservationCheckout({
  kind,
  id,
  customer,
  returnUrl,
  stripe,
}: {
  kind: Kind;
  id: string;
  customer: string;
  returnUrl: string;
  stripe: ReservationStripeGateway;
}) {
  if (!mongoose.isValidObjectId(id))
    throw new ReservationRuleError('Invalid reservation ID');
  const Model = modelFor(kind);
  let row = await Model.findOne({ _id: id, customer });
  if (!row) throw new ReservationRuleError('Reservation not found', 404);
  const summary = reservationPaymentSummary(row);
  if (
    !['pending', 'confirmed'].includes(row.status) ||
    summary.balanceCents <= 0 ||
    row.stripeRefund?.status === 'pending'
  )
    throw new ReservationRuleError('Reservation is not payable');
  if (row.checkout?.pending && row.checkout.sessionId) {
    const session = await stripe.checkout.sessions.retrieve(
      row.checkout.sessionId
    );
    if (session.status === 'open' && session.url) return session.url;
    if (session.status === 'expired') {
      await Model.updateOne(
        { _id: id, 'checkout.token': row.checkout.token },
        { $set: { 'checkout.pending': false }, $inc: { __v: 1 } }
      );
      throw new ReservationRuleError(
        'Checkout expired; retry to start a new checkout',
        409
      );
    }
    throw new ReservationRuleError(
      'Payment is being confirmed; refresh shortly',
      409
    );
  }
  if (!row.checkout?.pending) {
    const settings = await Settings.getSettings();
    row = await Model.findOneAndUpdate(
      { _id: id, __v: row.get('__v') },
      {
        $set: {
          checkout: {
            token: randomUUID(),
            amountCents: summary.balanceCents,
            currency: settings.currency.toLowerCase(),
            createdAt: new Date(),
            pending: true,
          },
        },
        $inc: { __v: 1 },
      },
      { new: true }
    );
    if (!row)
      throw new ReservationRuleError('Reservation changed; try again', 409);
  }
  const quote = row.checkout!;
  // Stripe may prune idempotency keys after 24 hours; do not recreate an unknown session.
  if (Date.now() - quote.createdAt.getTime() > 23 * 3600000)
    throw new ReservationRuleError('Checkout needs staff reconciliation', 409);
  const metadata = {
    reservationId: id,
    reservationKind: kind,
    quoteToken: quote.token,
  };
  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: quote.currency,
            unit_amount: quote.amountCents,
            product_data: {
              name: `${kind === 'dining' ? 'Dining' : 'Experience'} reservation`,
            },
          },
          quantity: 1,
        },
      ],
      metadata,
      payment_intent_data: { metadata },
      success_url: returnUrl,
      cancel_url: returnUrl,
    },
    { idempotencyKey: `reservation:${kind}:${id}:${quote.token}` }
  );
  await Model.updateOne(
    { _id: id, 'checkout.token': quote.token },
    { $set: { 'checkout.sessionId': session.id }, $inc: { __v: 1 } }
  );
  return session.url;
}

export async function settleReservationCheckout({
  kind,
  id,
  token,
  sessionId,
  amountCents,
  currency,
  paymentIntentId,
}: {
  kind: Kind;
  id: string;
  token: string;
  sessionId: string;
  amountCents: number;
  currency: string;
  paymentIntentId: string;
}) {
  const Model = modelFor(kind);
  for (let attempt = 0; attempt < 5; attempt++) {
    const row = await Model.findById(id);
    if (!row) throw new ReservationRuleError('Reservation not found', 404);
    if (
      row.receipts.some(
        (receipt: ReservationReceipt) => receipt.id === sessionId
      )
    )
      return;
    const quote = row.checkout;
    if (
      !quote ||
      quote.token !== token ||
      quote.amountCents !== amountCents ||
      quote.currency !== currency ||
      !paymentIntentId ||
      (quote.sessionId && quote.sessionId !== sessionId)
    )
      throw new ReservationRuleError(
        'Checkout does not match reservation',
        409
      );
    row.receipts.push({
      id: sessionId,
      type: 'payment',
      amountCents,
      method: 'stripe',
      reference: paymentIntentId,
      actor: 'stripe',
      recordedAt: new Date(),
    });
    row.stripePaymentIntentId = paymentIntentId;
    row.checkout.pending = false;
    row.isPaid = reservationPaymentSummary(row).balanceCents === 0;
    try {
      await row.save();
      return;
    } catch (error) {
      if (!(error instanceof mongoose.Error.VersionError)) throw error;
    }
  }
  throw new ReservationRuleError('Reservation changed; retry webhook', 409);
}
export async function expireReservationCheckout({
  kind,
  id,
  token,
}: {
  kind: Kind;
  id: string;
  token: string;
}) {
  await modelFor(kind).updateOne(
    { _id: id, 'checkout.token': token, 'checkout.pending': true },
    { $set: { 'checkout.pending': false }, $inc: { __v: 1 } }
  );
}

export async function refundReservationStripe({
  kind,
  id,
  token,
  amountCents,
  actor,
  reference,
  stripe,
}: {
  kind: Kind;
  id: string;
  token: string;
  amountCents: number;
  actor: string;
  reference: string;
  stripe: ReservationStripeGateway;
}) {
  if (!mongoose.isValidObjectId(id))
    throw new ReservationRuleError('Invalid reservation ID');
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0)
    throw new ReservationRuleError('Invalid refund amount');
  const Model = modelFor(kind);
  let row = await Model.findById(id);
  if (!row) throw new ReservationRuleError('Reservation not found', 404);
  const existing = row.receipts.find((r: ReservationReceipt) => r.id === token);
  if (existing) {
    if (
      existing.type !== 'refund' ||
      existing.amountCents !== amountCents ||
      existing.actor !== actor ||
      existing.reference !== reference
    )
      throw new ReservationRuleError('Request ID already used', 409);
    return { status: 'succeeded' };
  }
  if (row.checkout?.pending)
    throw new ReservationRuleError('Checkout is pending', 409);
  if (row.stripeRefund?.token === token) {
    if (
      row.stripeRefund.amountCents !== amountCents ||
      row.stripeRefund.actor !== actor ||
      row.stripeRefund.reference !== reference
    )
      throw new ReservationRuleError('Request ID already used', 409);
  } else {
    if (row.stripeRefund?.status === 'pending')
      throw new ReservationRuleError('Another refund is pending', 409);
    const available = row.receipts.reduce(
      (sum: number, r: ReservationReceipt) =>
        sum +
        (r.method === 'stripe'
          ? r.type === 'payment'
            ? r.amountCents
            : -r.amountCents
          : 0),
      0
    );
    if (!row.stripePaymentIntentId || amountCents > available)
      throw new ReservationRuleError('Refund exceeds online payments received');
    row = await Model.findOneAndUpdate(
      { _id: id, __v: row.get('__v') },
      {
        $set: {
          stripeRefund: {
            token,
            amountCents,
            actor,
            reference,
            createdAt: new Date(),
            status: 'pending',
          },
        },
        $inc: { __v: 1 },
      },
      { new: true }
    );
    if (!row) throw new ReservationRuleError('Reservation changed; retry', 409);
  }
  const operation = row.stripeRefund!;
  if (
    !operation.refundId &&
    Date.now() - operation.createdAt.getTime() > 23 * 3600000
  )
    throw new ReservationRuleError('Refund needs Stripe reconciliation', 409);
  const refund = operation.refundId
    ? await stripe.refunds.retrieve(operation.refundId)
    : await stripe.refunds.create(
        {
          payment_intent: row.stripePaymentIntentId!,
          amount: operation.amountCents,
          metadata: {
            reservationKind: kind,
            reservationId: id,
            refundToken: token,
          },
        },
        { idempotencyKey: `reservation-refund:${kind}:${id}:${token}` }
      );
  await settleReservationRefund({
    kind,
    id,
    token,
    refundId: refund.id,
    status: refund.status ?? 'pending',
  });
  return { status: refund.status };
}
export async function settleReservationRefund({
  kind,
  id,
  token,
  refundId,
  status,
}: {
  kind: Kind;
  id: string;
  token: string;
  refundId: string;
  status: string;
}) {
  const Model = modelFor(kind);
  for (let attempt = 0; attempt < 5; attempt++) {
    const row = await Model.findById(id);
    if (!row) throw new ReservationRuleError('Reservation not found', 404);
    const operation = row.stripeRefund;
    if (
      !operation ||
      operation.token !== token ||
      operation.status === 'succeeded'
    )
      return;
    operation.refundId = refundId;
    if (status === 'succeeded') {
      if (!row.receipts.some((r: ReservationReceipt) => r.id === token))
        row.receipts.push({
          id: token,
          type: 'refund',
          amountCents: operation.amountCents,
          method: 'stripe',
          actor: operation.actor,
          reference: operation.reference,
          recordedAt: new Date(),
        });
      operation.status = 'succeeded';
    } else if (['failed', 'canceled'].includes(status))
      operation.status = 'failed';
    try {
      await row.save();
      return;
    } catch (error) {
      if (!(error instanceof mongoose.Error.VersionError)) throw error;
    }
  }
  throw new ReservationRuleError('Reservation changed; retry refund', 409);
}
