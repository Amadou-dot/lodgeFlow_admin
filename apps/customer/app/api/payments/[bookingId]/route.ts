import { Booking, connectDB } from '@lodgeflow/database';
import { logger } from '@lodgeflow/database/logger';
import type { ApiResponse } from '@/types';
import type { BookingPaymentStatus } from '@/types/booking-read';
import { serializeBookingPaymentStatus } from '@/lib/serializers/booking-read';
import { paymentStatusParamsSchema } from '@/lib/validations/payment-status';
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

type Params = Promise<{ bookingId: string }>;

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

    const input = paymentStatusParamsSchema.safeParse(await params);
    if (!input.success) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Invalid booking ID',
      };
      return NextResponse.json(response, { status: 400 });
    }

    const { bookingId } = input.data;
    await connectDB();
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

    const response: ApiResponse<BookingPaymentStatus> = {
      success: true,
      data: serializeBookingPaymentStatus(booking),
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Error fetching payment status', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to fetch payment status',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
