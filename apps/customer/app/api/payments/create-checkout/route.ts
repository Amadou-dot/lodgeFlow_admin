import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { Booking, connectDB, Settings, roundMoney } from '@lodgeflow/database';
import { getStripe } from '@/lib/stripe';
import { normalizeBaseUrl } from '@/lib/url';
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

const errorResponse = (error: string, status: number) =>
  NextResponse.json({ success: false, error }, { status });

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return errorResponse('Authentication required', 401);
    const { bookingId } = await request.json();
    if (!mongoose.isValidObjectId(bookingId))
      return errorResponse('Invalid booking ID', 400);
    await connectDB();
    let booking = await Booking.findOne({
      _id: bookingId,
      customer: userId,
    }).populate('cabin');
    if (!booking) return errorResponse('Booking not found', 404);
    if (booking.isPaid || booking.status === 'cancelled')
      return errorResponse('Booking is not payable', 400);
    const settings = await Settings.getSettings();
    const stripe = getStripe();
    if (booking.checkoutPending && booking.stripeSessionId) {
      const session = await stripe.checkout.sessions.retrieve(
        booking.stripeSessionId
      );
      if (session.status === 'open' && session.url)
        return NextResponse.json({ success: true, data: { url: session.url } });
      if (session.status === 'expired') {
        await Booking.updateOne(
          {
            _id: bookingId,
            checkoutToken: booking.checkoutToken,
            checkoutPending: true,
          },
          {
            $set: { checkoutPending: false },
            $unset: { stripeSessionId: 1 },
            $inc: { __v: 1 },
          }
        );
        return errorResponse('Checkout expired; please try again', 409);
      }
      return errorResponse('Payment is being confirmed; refresh shortly', 409);
    }
    if (!booking.checkoutPending) {
      const amount = roundMoney(
        Math.min(
          booking.remainingAmount,
          booking.amountPaid < booking.depositAmount
            ? booking.depositAmount - booking.amountPaid
            : booking.remainingAmount
        )
      );
      if (amount <= 0) return errorResponse('No payment is due', 400);
      const reserved = await Booking.findOneAndUpdate(
        { _id: bookingId, __v: booking.get('__v'), checkoutPending: false },
        {
          $set: {
            checkoutPending: true,
            checkoutToken: randomUUID(),
            checkoutAmount: amount,
            checkoutTotalPrice: booking.totalPrice,
            checkoutCurrency: settings.currency.toLowerCase(),
          },
          $unset: { stripeSessionId: 1 },
          $inc: { __v: 1 },
        },
        { new: true }
      ).populate('cabin');
      if (!reserved)
        return errorResponse('Booking changed; refresh and try again', 409);
      booking = reserved;
    }
    // Retain the quote token on failures: retrying the same Stripe idempotency key
    // recovers a session whose creation succeeded before a connection was lost.
    const baseUrl = normalizeBaseUrl(
      process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
    );
    const cabin = booking.cabin as unknown as { name: string };
    const isDeposit = booking.amountPaid < booking.depositAmount;
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: booking.checkoutCurrency!,
              unit_amount: Math.round(booking.checkoutAmount! * 100),
              product_data: {
                name: cabin.name,
                description: isDeposit ? 'Booking deposit' : 'Booking balance',
              },
            },
            quantity: 1,
          },
        ],
        metadata: {
          bookingId: String(booking._id),
          userId,
          isDeposit: String(isDeposit),
          quoteToken: booking.checkoutToken!,
        },
        payment_intent_data: {
          metadata: {
            bookingId: String(booking._id),
            userId,
            quoteToken: booking.checkoutToken!,
          },
        },
        success_url: `${baseUrl}/payments/success?session_id={CHECKOUT_SESSION_ID}&booking_id=${booking._id}`,
        cancel_url: `${baseUrl}/payments/cancel?booking_id=${booking._id}`,
      },
      { idempotencyKey: `booking:${booking._id}:${booking.checkoutToken}` }
    );
    await Booking.updateOne(
      {
        _id: bookingId,
        checkoutToken: booking.checkoutToken,
        checkoutPending: true,
      },
      { $set: { stripeSessionId: session.id }, $inc: { __v: 1 } }
    );
    return NextResponse.json({ success: true, data: { url: session.url } });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return errorResponse('Failed to create checkout session', 500);
  }
}
