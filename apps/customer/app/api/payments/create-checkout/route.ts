import { randomUUID } from 'crypto';
import { Booking, connectDB, Settings } from '@lodgeflow/database';
import {
  majorAmount,
  majorToCents,
  roundMajorAmount,
} from '@lodgeflow/database/money';
import type { ICabin } from '@lodgeflow/database';
import { logger } from '@lodgeflow/database/logger';
import { getStripe } from '@/lib/stripe';
import { normalizeBaseUrl } from '@/lib/url';
import { createCheckoutSchema } from '@/lib/validations/checkout';
import { readJsonRequestBody } from '@/lib/validations/request-body';
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

type CheckoutPopulation = { cabin: Pick<ICabin, 'name'> | null };

const errorResponse = (error: string, status: number) =>
  NextResponse.json({ success: false, error }, { status });

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return errorResponse('Authentication required', 401);
    const body = await readJsonRequestBody(request);
    if (!body.success) return errorResponse(body.error, 400);
    const input = createCheckoutSchema.safeParse(body.data);
    if (!input.success) return errorResponse('Invalid booking ID', 400);
    const { bookingId } = input.data;
    await connectDB();
    let booking = await Booking.findOne({
      _id: bookingId,
      customer: userId,
    }).populate<CheckoutPopulation>('cabin');
    if (!booking) return errorResponse('Booking not found', 404);
    if (booking.isPaid || booking.status === 'cancelled')
      return errorResponse('Booking is not payable', 400);
    if (!booking.cabin) return errorResponse('Cabin not found', 404);
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
      const remainingAmount = majorAmount(booking.remainingAmount, {
        precision: 'preserve',
      });
      const amountPaid = majorAmount(booking.amountPaid, {
        precision: 'exact',
      });
      const depositAmount = majorAmount(booking.depositAmount, {
        precision: 'preserve',
      });
      const totalPrice = majorAmount(booking.totalPrice, {
        precision: 'preserve',
      });
      const amount = roundMajorAmount({
        amount: majorAmount(
          Math.min(
            remainingAmount,
            amountPaid < depositAmount
              ? depositAmount - amountPaid
              : remainingAmount
          ),
          { precision: 'preserve' }
        ),
        rounding: 'epsilon',
      });
      if (amount <= 0) return errorResponse('No payment is due', 400);
      const reserved = await Booking.findOneAndUpdate(
        { _id: bookingId, __v: booking.get('__v'), checkoutPending: false },
        {
          $set: {
            checkoutPending: true,
            checkoutToken: randomUUID(),
            checkoutAmount: amount,
            checkoutTotalPrice: totalPrice,
            checkoutCurrency: settings.currency.toLowerCase(),
          },
          $unset: { stripeSessionId: 1 },
          $inc: { __v: 1 },
        },
        { new: true }
      ).populate<CheckoutPopulation>('cabin');
      if (!reserved)
        return errorResponse('Booking changed; refresh and try again', 409);
      booking = reserved;
    }
    // Population runs again after reservation; the cabin may have disappeared.
    // Retain the reserved quote, as with provider failure, without creating a session.
    const cabin = booking.cabin;
    if (!cabin) return errorResponse('Cabin not found', 404);
    const checkoutAmount = majorToCents({
      amount: majorAmount(booking.checkoutAmount!, {
        precision: 'exact',
        sign: 'positive',
      }),
      rounding: 'nearest',
    });
    // Retain the quote token on failures: retrying the same Stripe idempotency key
    // recovers a session whose creation succeeded before a connection was lost.
    const baseUrl = normalizeBaseUrl(
      process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
    );
    const isDeposit = booking.amountPaid < booking.depositAmount;
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: booking.checkoutCurrency!,
              unit_amount: checkoutAmount,
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
  } catch (error: unknown) {
    logger.error('Error creating checkout session', error);
    return errorResponse('Failed to create checkout session', 500);
  }
}
