import { serializeBookingDetail } from '@/lib/serializers/booking-read';
import type { BookingDetail } from '@/types/booking-read';
import type { ApiResponse } from '@/types';
import {
  connectDB,
  createCustomerBooking,
  BookingRuleError,
  BookingPricingError,
  CabinBookingLockTimeoutError,
} from '@lodgeflow/database';
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createBookingSchema } from '@/lib/validations';
import {
  validateRequest,
  validationErrorResponse,
} from '@/lib/validations/utils';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    const validation = validateRequest(
      createBookingSchema,
      await request.json()
    );
    if (!validation.success) return validationErrorResponse(validation.error);
    await connectDB();
    const booking = await createCustomerBooking({
      ...validation.data,
      customerId: userId,
    });
    const response: ApiResponse<BookingDetail> = {
      success: true,
      data: serializeBookingDetail(booking),
      message: 'Booking created successfully',
    };
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    if (
      error instanceof BookingRuleError ||
      error instanceof BookingPricingError ||
      error instanceof CabinBookingLockTimeoutError
    ) {
      const status =
        error instanceof BookingRuleError
          ? error.status
          : error instanceof CabinBookingLockTimeoutError
            ? 409
            : 400;
      return NextResponse.json(
        { success: false, error: error.message },
        { status }
      );
    }
    console.error('Error creating booking:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create booking' },
      { status: 500 }
    );
  }
}
