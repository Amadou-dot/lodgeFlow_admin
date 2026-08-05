import { Booking, connectDB } from '@/models';
import type { ApiResponse } from '@/types';
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

type Params = Promise<{ bookingId: string }>;

interface PaymentStatusData {
  isPaid: boolean;
  depositPaid: boolean;
  depositAmount: number;
  totalPrice: number;
  paidAt?: Date;
  stripeSessionId?: string;
  refundAmount?: number;
  refundedAt?: Date;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Params }
) {
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

    const { bookingId } = await params;
    const booking = await Booking.findById(bookingId);

    if (!booking) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Booking not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    if (booking.customer.toString() !== userId) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Booking not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    const paymentStatus: PaymentStatusData = {
      isPaid: booking.isPaid,
      depositPaid: booking.depositPaid,
      depositAmount: booking.depositAmount,
      totalPrice: booking.totalPrice,
      paidAt: booking.paidAt,
      stripeSessionId: booking.stripeSessionId,
      refundAmount: booking.refundAmount,
      refundedAt: booking.refundedAt,
    };

    const response: ApiResponse<PaymentStatusData> = {
      success: true,
      data: paymentStatus,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching payment status:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to fetch payment status',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
