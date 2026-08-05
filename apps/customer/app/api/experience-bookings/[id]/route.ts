import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

import { connectDB, ExperienceBooking } from '@/models';
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

export async function PATCH(
  request: NextRequest,
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
    const booking = await ExperienceBooking.findById(id);

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

    if (booking.status === 'cancelled' || booking.status === 'completed') {
      const response: ApiResponse<never> = {
        success: false,
        error: `Cannot update a ${booking.status} booking`,
      };
      return NextResponse.json(response, { status: 400 });
    }

    const updates = await request.json();
    const allowedFields = [
      'date',
      'timeSlot',
      'numParticipants',
      'specialRequests',
      'observations',
    ];

    const filteredUpdates: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        filteredUpdates[key] = updates[key];
      }
    }

    const updated = await ExperienceBooking.findByIdAndUpdate(
      id,
      filteredUpdates,
      { new: true }
    ).populate('experience');

    const response: ApiResponse<typeof updated> = {
      success: true,
      data: updated,
      message: 'Experience booking updated successfully',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error updating experience booking:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to update experience booking',
    };
    return NextResponse.json(response, { status: 500 });
  }
}

export async function DELETE(
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
    const booking = await ExperienceBooking.findById(id);

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

    if (booking.status === 'cancelled' || booking.status === 'completed') {
      const response: ApiResponse<never> = {
        success: false,
        error: `Cannot cancel a ${booking.status} booking`,
      };
      return NextResponse.json(response, { status: 400 });
    }

    await ExperienceBooking.findByIdAndUpdate(id, { status: 'cancelled' });

    const response: ApiResponse<null> = {
      success: true,
      data: null,
      message: 'Experience booking cancelled successfully',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error cancelling experience booking:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to cancel experience booking',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
