import {
  updateExperienceReservation,
  ReservationRuleError,
} from '@lodgeflow/database';
import { updateExperienceDetailsSchema } from '@/lib/validations/experience-booking';
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

import { connectDB, ExperienceBooking } from '@lodgeflow/database';
import type { ApiResponse } from '@/types';

type Params = Promise<{ id: string }>;

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

    const { id } = await params;
    const booking = await ExperienceBooking.findById(id).populate('experience');

    if (!booking) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Experience booking not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    if (booking.customer !== userId) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Experience booking not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    const response: ApiResponse<typeof booking> = {
      success: true,
      data: booking,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching experience booking:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to fetch experience booking',
    };
    return NextResponse.json(response, { status: 500 });
  }
}

async function change(request: NextRequest, params: Params, cancel: boolean) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    const parsed = updateExperienceDetailsSchema.safeParse(
      cancel ? {} : await request.json()
    );
    if (!parsed.success)
      return NextResponse.json(
        { success: false, error: 'Invalid reservation details' },
        { status: 400 }
      );
    await connectDB();
    const { id } = await params;
    const data = await updateExperienceReservation(
      id,
      userId,
      parsed.data,
      cancel
    );
    return NextResponse.json({
      success: true,
      data,
      message: cancel
        ? 'Reservation cancelled successfully'
        : 'Reservation updated successfully',
    });
  } catch (error) {
    if (error instanceof ReservationRuleError)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    console.error('Failed to change reservation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to change reservation' },
      { status: 500 }
    );
  }
}
export async function PATCH(
  request: NextRequest,
  { params }: { params: Params }
) {
  return change(request, params, false);
}
export async function DELETE(
  request: NextRequest,
  { params }: { params: Params }
) {
  return change(request, params, true);
}
