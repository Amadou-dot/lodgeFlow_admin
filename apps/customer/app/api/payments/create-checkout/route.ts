import { Booking, connectDB, Settings } from '@/models';
import { getStripe } from '@/lib/stripe';
import type { ApiResponse, PopulatedBooking } from '@/types';
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Authentication required',
      };
      return NextResponse.json(response, { status: 401 });
    }

    await connectDB();

    const { bookingId } = await request.json();

    if (!bookingId) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Booking ID is required',
      };
      return NextResponse.json(response, { status: 400 });
    }

    const booking = (await Booking.findById(bookingId).populate(
      'cabin'
    )) as unknown as PopulatedBooking;
    if (!booking) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Booking not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    if (booking.customer !== userId) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Not authorized to pay for this booking',
      };
      return NextResponse.json(response, { status: 403 });
    }

    if (booking.isPaid) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Booking is already paid',
      };
      return NextResponse.json(response, { status: 400 });
    }

    if (booking.status === 'cancelled') {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Cannot pay for a cancelled booking',
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Determine payment amount based on deposit settings
    const settings = await Settings.getSettings();
    let paymentAmount: number;
    let paymentDescription: string;
    let isDepositPayment = false;

    if (booking.depositPaid && booking.depositAmount > 0) {
      paymentAmount = booking.totalPrice - booking.depositAmount;
      paymentDescription = `Remaining balance for ${booking.cabin.name}`;
    } else if (settings.requireDeposit && booking.depositAmount > 0) {
      paymentAmount = booking.depositAmount;
      paymentDescription = `Deposit for ${booking.cabin.name}`;
      isDepositPayment = true;
    } else {
      paymentAmount = booking.totalPrice;
      paymentDescription = `Full payment for ${booking.cabin.name}`;
    }

    if (paymentAmount <= 0) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Payment amount must be greater than zero',
      };
      return NextResponse.json(response, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: settings.currency?.toLowerCase() || 'usd',
            product_data: {
              name: booking.cabin.name,
              description: paymentDescription,
            },
            unit_amount: Math.round(paymentAmount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        bookingId: booking._id.toString(),
        userId,
        isDeposit: String(isDepositPayment),
      },
      payment_intent_data: {
        metadata: {
          bookingId: booking._id.toString(),
          userId,
          isDeposit: String(isDepositPayment),
        },
      },
      mode: 'payment',
      success_url: `${baseUrl}/payments/success?session_id={CHECKOUT_SESSION_ID}&booking_id=${booking._id}`,
      cancel_url: `${baseUrl}/payments/cancel?booking_id=${booking._id}`,
    });

    // Store session ID on booking
    await Booking.findByIdAndUpdate(bookingId, {
      stripeSessionId: session.id,
    });

    const response: ApiResponse<{ url: string }> = {
      success: true,
      data: { url: session.url! },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error creating checkout session:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to create checkout session',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
