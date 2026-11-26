import { logger } from '@lodgeflow/database/logger';
import { sendReservationConfirmation } from '@/lib/reservation-confirmation-email';
import mongoose from 'mongoose';
import {
  Booking,
  settleReservationCheckout,
  expireReservationCheckout,
  settleReservationRefund,
  ProcessedStripeEvent,
  connectDB,
  settleCheckoutPayment,
} from '@lodgeflow/database';
import {
  cents,
  centsToMajor,
  majorAmount,
  roundMajorAmount,
} from '@lodgeflow/database/money';
import { sendPaymentConfirmationEmail } from '@/lib/email';
import type { PaymentEmailCabin } from '@/types/payment-email';
import { serializePaymentEmailBooking } from '@/lib/serializers/payment-email';
import {
  assertWebhookObject,
  optionalWebhookId,
  requireWebhookString,
  reservationTarget,
  webhookMetadata,
  webhookPaymentIntent,
} from '@/lib/stripe-webhook-event';
import { getStripe } from '@/lib/stripe';
import {
  logStripeWebhookFailure,
  type StripeWebhookVerificationStage,
} from '@/lib/stripe-webhook-diagnostics';
import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');
  if (!signature)
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  let event: Stripe.Event;
  let stage: StripeWebhookVerificationStage = 'stripe-client';
  try {
    const stripe = getStripe();
    stage = 'request-body';
    const body = await request.text();
    stage = 'signature';
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    logStripeWebhookFailure({ stage, error, signature });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }
  try {
    const eventId = requireWebhookString(event?.id);
    await connectDB();
    if (await ProcessedStripeEvent.exists({ eventId }))
      return NextResponse.json({ received: true });
    const eventType = requireWebhookString(event.type);
    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded'
    ) {
      const session = event.data?.object;
      assertWebhookObject(session);
      if (requireWebhookString(session.payment_status) === 'paid') {
        const metadata = webhookMetadata(session.metadata);
        const target = reservationTarget(metadata);
        if (target) {
          await settleReservationCheckout({
            ...target,
            token: requireWebhookString(metadata.quoteToken),
            sessionId: session.id,
            amountCents: cents(session.amount_total ?? 0, { sign: 'positive' }),
            currency: session.currency ?? '',
            paymentIntentId: webhookPaymentIntent(session.payment_intent) ?? '',
          });
          await sendReservationConfirmation(target);
        }
        const bookingId = optionalWebhookId(metadata.bookingId);
        if (bookingId) {
          const amount = centsToMajor(
            cents(session.amount_total ?? 0, { sign: 'positive' })
          );
          const result = await settleCheckoutPayment({
            bookingId,
            sessionId: session.id,
            quoteToken: requireWebhookString(metadata.quoteToken),
            amount,
            currency: session.currency ?? '',
            paymentIntentId: webhookPaymentIntent(session.payment_intent) ?? '',
          });
          if (result.changed && result.booking) {
            const booking = await result.booking.populate<{
              cabin: PaymentEmailCabin | null;
            }>('cabin');
            // Email is best-effort; durable receipt accounting has already succeeded.
            try {
              if (booking.cabin) {
                const email = await sendPaymentConfirmationEmail({
                  booking: serializePaymentEmailBooking(booking),
                  cabin: { name: booking.cabin.name },
                  amountPaid: amount,
                  isDeposit: metadata.isDeposit === 'true',
                });
                if (email.success)
                  await Booking.updateOne(
                    { _id: booking._id },
                    { $set: { paymentConfirmationSentAt: new Date() } }
                  );
              }
            } catch (error) {
              logger.error('Payment confirmation email failed:', error);
            }
          }
        }
      }
    } else if (event.type === 'checkout.session.expired') {
      const session = event.data?.object;
      assertWebhookObject(session);
      const metadata = webhookMetadata(session.metadata);
      const target = reservationTarget(metadata);
      if (target)
        await expireReservationCheckout({
          ...target,
          token: requireWebhookString(metadata.quoteToken),
        });
      const bookingId = optionalWebhookId(metadata.bookingId);
      if (bookingId)
        await Booking.updateOne(
          {
            _id: bookingId,
            checkoutToken: requireWebhookString(metadata.quoteToken),
            checkoutPending: true,
          },
          {
            $set: { checkoutPending: false },
            $unset: { stripeSessionId: 1 },
            $inc: { __v: 1 },
          }
        );
    } else if (
      event.type === 'refund.created' ||
      event.type === 'refund.updated' ||
      event.type === 'refund.failed'
    ) {
      const refund = event.data?.object;
      assertWebhookObject(refund);
      const metadata = webhookMetadata(refund.metadata);
      const target = reservationTarget(metadata);
      if (target)
        await settleReservationRefund({
          ...target,
          // The domain compares this token strictly before consuming refund details.
          token: refund.metadata?.refundToken ?? '',
          refundId: refund.id,
          status: refund.status ?? 'pending',
        });
    } else if (event.type === 'charge.refunded') {
      const charge = event.data?.object;
      assertWebhookObject(charge);
      const intent = webhookPaymentIntent(charge.payment_intent);
      if (intent) {
        const providerRefund = centsToMajor(cents(charge.amount_refunded));
        for (let attempt = 0; attempt < 5; attempt++) {
          const booking = await Booking.findOne({
            'payments.paymentIntentId': intent,
          });
          if (!booking) break;
          const payment = booking.payments.find(
            p => p.paymentIntentId === intent
          )!;
          const refundedAmount = majorAmount(
            Math.max(
              majorAmount(payment.refundedAmount ?? 0, { precision: 'exact' }),
              providerRefund
            ),
            { precision: 'exact' }
          );
          const refundAmount = roundMajorAmount({
            amount: booking.payments.reduce(
              (sum, entry) =>
                majorAmount(
                  sum +
                    (entry === payment
                      ? refundedAmount
                      : majorAmount(entry.refundedAmount ?? 0, {
                          precision: 'exact',
                        })),
                  { precision: 'preserve' }
                ),
              majorAmount(0, { precision: 'exact' })
            ),
            rounding: 'epsilon',
          });
          const amountPaid = majorAmount(booking.amountPaid, {
            precision: 'exact',
          });
          payment.refundedAmount = refundedAmount;
          booking.refundAmount = refundAmount;
          booking.refundStatus =
            refundAmount >= amountPaid ? 'full' : 'partial';
          booking.refundedAt = new Date();
          try {
            await booking.save();
            break;
          } catch (error) {
            if (
              !(error instanceof mongoose.Error.VersionError) ||
              attempt === 4
            )
              throw error;
          }
        }
      }
    }
    // Mark only after success. Receipt IDs make concurrent/retried processing safe;
    // a failed request leaves no premature claim that could swallow Stripe retries.
    await ProcessedStripeEvent.updateOne(
      { eventId },
      {
        $setOnInsert: {
          eventId,
          eventType,
          processedAt: new Date(),
        },
      },
      { upsert: true }
    );
    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
