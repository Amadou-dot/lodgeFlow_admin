import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import {
  connectDB,
  ExperienceBooking,
  createExperienceReservation,
  ReservationRuleError,
} from '@lodgeflow/database';
import type { ApiResponse } from '@/types';
import { createExperienceBookingSchema } from '@/lib/validations';
import {
  validateRequest,
  validationErrorResponse,
} from '@/lib/validations/utils';
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    const validation = validateRequest(
      createExperienceBookingSchema,
      await request.json()
    );
    if (!validation.success) return validationErrorResponse(validation.error);
    await connectDB();
    const { experienceId, ...selection } = validation.data;
    const data = await createExperienceReservation(
      experienceId,
      userId,
      selection
    );
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    if (error instanceof ReservationRuleError)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    console.error('Failed to create reservation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create reservation' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const query: Record<string, unknown> = { customer: userId };
    if (status) {
      query.status = status;
    }

    const bookings = await ExperienceBooking.find(query)
      .populate('experience', 'name image price duration category')
      .sort({ createdAt: -1 })
      .lean();

    const response: ApiResponse<typeof bookings> = {
      success: true,
      data: bookings,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching experience bookings:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to fetch experience bookings',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
