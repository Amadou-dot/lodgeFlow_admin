import { Booking, ProcessedStripeEvent, connectDB } from '@/models';
import { sendPaymentConfirmationEmail } from '@/lib/email';
import type { PopulatedBooking } from '@/types';
import { getStripe } from '@/lib/stripe';
import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';

/**
 * Atomically claims an event for processing using upsert.
 * Returns true if this is the first time claiming (should process),
 * false if already claimed by another request (skip processing).
 * This prevents race conditions where two concurrent requests both pass a check-then-insert.
 */
async function claimEventForProcessing(
  eventId: string,
  eventType: string
): Promise<boolean> {
  try {
    // Use findOneAndUpdate with upsert to atomically claim the event
    // If the event already exists, this returns the existing doc (we should skip)
    // If the event doesn't exist, it creates it and returns null for the original doc
    const existingEvent = await ProcessedStripeEvent.findOneAndUpdate(
      { eventId },
      { $setOnInsert: { eventId, eventType, processedAt: new Date() } },
      { upsert: true, new: false } // Return the OLD document (null if didn't exist)
    );

    // If existingEvent is null, we successfully claimed it (first time)
    // If existingEvent exists, another request already claimed it
    return existingEvent === null;
  } catch (error: unknown) {
    // Handle duplicate key error (race condition where both try to insert)
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 11000
    ) {
      return false; // Already processed by another request
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  await connectDB();

  // Atomically claim the event for processing to prevent race conditions
  // This returns true if we should process, false if already processed by another request
  const shouldProcess = await claimEventForProcessing(event.id, event.type);
  if (!shouldProcess) {
    return NextResponse.json({ received: true, status: 'already_processed' });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const bookingId = session.metadata?.bookingId;
        const isDeposit = session.metadata?.isDeposit === 'true';

        if (bookingId) {
          const booking = (await Booking.findById(bookingId).populate(
            'cabin',
            'name image capacity price discount description'
          )) as unknown as PopulatedBooking | null;

          if (!booking) {
            console.error(`Booking not found: ${bookingId}`);
            break;
          }

          // Guard against duplicate updates
          if (isDeposit && booking.depositPaid) {
            break;
          }
          if (!isDeposit && booking.isPaid) {
            break;
          }

          const updateData: Record<string, unknown> = {
            stripePaymentIntentId: session.payment_intent as string,
            stripeSessionId: session.id,
            paidAt: new Date(),
            status: 'confirmed',
          };

          if (isDeposit) {
            updateData.depositPaid = true;
          } else {
            updateData.isPaid = true;
          }

          await Booking.findByIdAndUpdate(bookingId, updateData);

          // Auto-send payment confirmation email (check if not already sent)
          if (!booking.paymentConfirmationSentAt) {
            const amountPaid = isDeposit
              ? booking.depositAmount
              : booking.totalPrice;

            const emailResult = await sendPaymentConfirmationEmail({
              booking,
              cabin: booking.cabin,
              amountPaid,
              isDeposit,
            });

            if (emailResult.success) {
              await Booking.findByIdAndUpdate(bookingId, {
                paymentConfirmationSentAt: new Date(),
              });
            } else {
              console.error(
                'Failed to send payment confirmation email:',
                emailResult.error
              );
            }
          }
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const bookingId = paymentIntent.metadata?.bookingId;

        if (bookingId) {
          const booking = await Booking.findById(bookingId);
          if (!booking) {
            console.error(`Booking not found: ${bookingId}`);
            break;
          }

          // Only update if not already set
          if (!booking.stripePaymentIntentId) {
            await Booking.findByIdAndUpdate(bookingId, {
              stripePaymentIntentId: paymentIntent.id,
            });
          }
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = charge.payment_intent as string;

        if (paymentIntentId) {
          const booking = await Booking.findOne({
            stripePaymentIntentId: paymentIntentId,
          });

          if (booking) {
            const refundAmountDollars = charge.amount_refunded / 100;
            const totalPaid = booking.isPaid
              ? booking.totalPrice
              : booking.depositAmount;

            // Determine refund status based on amount
            let refundStatus: 'partial' | 'full' = 'partial';
            if (Math.abs(refundAmountDollars - totalPaid) < 0.01) {
              refundStatus = 'full';
            }

            await Booking.findByIdAndUpdate(booking._id, {
              refundAmount: refundAmountDollars,
              refundedAt: new Date(),
              refundStatus,
            });
          }
        }
        break;
      }
    }

    // Event was already claimed/marked at the start via claimEventForProcessing
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    // Don't mark as processed on error so Stripe can retry
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
