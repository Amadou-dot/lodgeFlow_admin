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
  roundMoney,
} from '@lodgeflow/database';
import { sendPaymentConfirmationEmail } from '@/lib/email';
import type { PopulatedBooking } from '@/types';
import { getStripe } from '@/lib/stripe';
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
  try {
    event = getStripe().webhooks.constructEvent(
      await request.text(),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }
  try {
    await connectDB();
    if (await ProcessedStripeEvent.exists({ eventId: event.id }))
      return NextResponse.json({ received: true });
    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded'
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      const kind = session.metadata?.reservationKind;
      if (
        session.payment_status === 'paid' &&
        (kind === 'dining' || kind === 'experience') &&
        session.metadata?.reservationId
      ) {
        await settleReservationCheckout({
          kind,
          id: session.metadata.reservationId,
          token: session.metadata.quoteToken ?? '',
          sessionId: session.id,
          amountCents: session.amount_total ?? 0,
          currency: session.currency ?? '',
          paymentIntentId:
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : (session.payment_intent?.id ?? ''),
        });
      }
      if (
        session.payment_status === 'paid' &&
        (kind === 'dining' || kind === 'experience') &&
        session.metadata?.reservationId
      )
        await sendReservationConfirmation({
          kind,
          id: session.metadata.reservationId,
        });
      if (session.payment_status === 'paid' && session.metadata?.bookingId) {
        const result = await settleCheckoutPayment({
          bookingId: session.metadata.bookingId,
          sessionId: session.id,
          quoteToken: session.metadata.quoteToken ?? '',
          amount: (session.amount_total ?? 0) / 100,
          currency: session.currency ?? '',
          paymentIntentId:
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : (session.payment_intent?.id ?? ''),
        });
        if (result.changed && result.booking) {
          const booking = await result.booking.populate('cabin');
          const populated = booking as unknown as PopulatedBooking;
          // Email is best-effort; durable receipt accounting has already succeeded.
          try {
            const email = await sendPaymentConfirmationEmail({
              booking: populated,
              cabin: populated.cabin,
              amountPaid: (session.amount_total ?? 0) / 100,
              isDeposit: session.metadata.isDeposit === 'true',
            });
            if (email.success)
              await Booking.updateOne(
                { _id: booking._id },
                { $set: { paymentConfirmationSentAt: new Date() } }
              );
          } catch (error) {
            console.error('Payment confirmation email failed:', error);
          }
        }
      }
    } else if (event.type === 'checkout.session.expired') {
      const session = event.data.object as Stripe.Checkout.Session;
      const kind = session.metadata?.reservationKind;
      if (
        (kind === 'dining' || kind === 'experience') &&
        session.metadata?.reservationId
      )
        await expireReservationCheckout({
          kind,
          id: session.metadata.reservationId,
          token: session.metadata.quoteToken ?? '',
        });
      if (session.metadata?.bookingId)
        await Booking.updateOne(
          {
            _id: session.metadata.bookingId,
            checkoutToken: session.metadata.quoteToken,
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
      const refund = event.data.object as Stripe.Refund;
      const kind = refund.metadata?.reservationKind;
      if (
        (kind === 'dining' || kind === 'experience') &&
        refund.metadata?.reservationId
      )
        await settleReservationRefund({
          kind,
          id: refund.metadata.reservationId,
          token: refund.metadata.refundToken ?? '',
          refundId: refund.id,
          status: refund.status ?? 'pending',
        });
    } else if (event.type === 'charge.refunded') {
      const charge = event.data.object as Stripe.Charge;
      const intent =
        typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent?.id;
      if (intent)
        for (let attempt = 0; attempt < 5; attempt++) {
          const booking = await Booking.findOne({
            'payments.paymentIntentId': intent,
          });
          if (!booking) break;
          const payment = booking.payments.find(
            p => p.paymentIntentId === intent
          )!;
          payment.refundedAmount = Math.max(
            payment.refundedAmount ?? 0,
            charge.amount_refunded / 100
          );
          booking.refundAmount = roundMoney(
            booking.payments.reduce(
              (sum, p) => sum + (p.refundedAmount ?? 0),
              0
            )
          );
          booking.refundStatus =
            booking.refundAmount >= booking.amountPaid ? 'full' : 'partial';
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
    // Mark only after success. Receipt IDs make concurrent/retried processing safe;
    // a failed request leaves no premature claim that could swallow Stripe retries.
    await ProcessedStripeEvent.updateOne(
      { eventId: event.id },
      {
        $setOnInsert: {
          eventId: event.id,
          eventType: event.type,
          processedAt: new Date(),
        },
      },
      { upsert: true }
    );
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
