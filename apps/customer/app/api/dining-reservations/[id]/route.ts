import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

import { connectDB, Dining, DiningReservation } from '@/models';
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
    const reservation = await DiningReservation.findById(id).populate('dining');

    if (!reservation) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Dining reservation not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    if (reservation.customer !== userId) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Dining reservation not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    const response: ApiResponse<typeof reservation> = {
      success: true,
      data: reservation,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching dining reservation:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to fetch dining reservation',
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
    const reservation = await DiningReservation.findById(id);

    if (!reservation) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Dining reservation not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    if (reservation.customer !== userId) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Dining reservation not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    if (
      reservation.status === 'cancelled' ||
      reservation.status === 'completed' ||
      reservation.status === 'no-show'
    ) {
      const response: ApiResponse<never> = {
        success: false,
        error: `Cannot update a ${reservation.status} reservation`,
      };
      return NextResponse.json(response, { status: 400 });
    }

    const updates = await request.json();
    const allowedFields = [
      'date',
      'time',
      'numGuests',
      'dietaryRequirements',
      'specialRequests',
      'tablePreference',
      'occasion',
    ];

    const filteredUpdates: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        filteredUpdates[key] = updates[key];
      }
    }

    // Load the dining item for validation
    const dining = await Dining.findById(reservation.dining);
    if (!dining) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Associated dining item not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    // Determine effective values after update
    const effectiveDate = filteredUpdates.date
      ? new Date(filteredUpdates.date as string)
      : reservation.date;
    const effectiveTime = (filteredUpdates.time as string) || reservation.time;
    const effectiveGuests = filteredUpdates.numGuests
      ? Math.floor(Number(filteredUpdates.numGuests))
      : reservation.numGuests;

    // Validate date is not in the past
    if (filteredUpdates.date) {
      if (isNaN(new Date(filteredUpdates.date as string).getTime())) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Invalid date',
        };
        return NextResponse.json(response, { status: 400 });
      }
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const updateDay = new Date(effectiveDate);
      updateDay.setHours(0, 0, 0, 0);
      if (updateDay < todayStart) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Cannot set a date in the past',
        };
        return NextResponse.json(response, { status: 400 });
      }
    }

    // Validate time is within serving window
    if (filteredUpdates.time) {
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(effectiveTime)) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Time must be in HH:MM format',
        };
        return NextResponse.json(response, { status: 400 });
      }
      const [reqHour, reqMin] = effectiveTime.split(':').map(Number);
      const [startHour, startMin] = dining.servingTime.start
        .split(':')
        .map(Number);
      const [endHour, endMin] = dining.servingTime.end.split(':').map(Number);
      const reqMinutes = reqHour * 60 + reqMin;
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      if (reqMinutes < startMinutes || reqMinutes > endMinutes) {
        const response: ApiResponse<never> = {
          success: false,
          error: `Reservations are only available between ${dining.servingTime.start} and ${dining.servingTime.end}`,
        };
        return NextResponse.json(response, { status: 400 });
      }
    }

    // Validate guest count
    if (filteredUpdates.numGuests) {
      if (!Number.isFinite(effectiveGuests) || effectiveGuests < 1) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Number of guests must be at least 1',
        };
        return NextResponse.json(response, { status: 400 });
      }
      if (effectiveGuests > dining.maxPeople) {
        const response: ApiResponse<never> = {
          success: false,
          error: `Maximum ${dining.maxPeople} guests allowed`,
        };
        return NextResponse.json(response, { status: 400 });
      }
      if (effectiveGuests < dining.minPeople) {
        const response: ApiResponse<never> = {
          success: false,
          error: `Minimum ${dining.minPeople} guests required`,
        };
        return NextResponse.json(response, { status: 400 });
      }
    }

    // Check capacity if date, time, or numGuests changed
    if (
      filteredUpdates.date ||
      filteredUpdates.time ||
      filteredUpdates.numGuests
    ) {
      const dayStart = new Date(effectiveDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(effectiveDate);
      dayEnd.setHours(23, 59, 59, 999);

      const existingReservations = await DiningReservation.find({
        _id: { $ne: id }, // exclude current reservation
        dining: reservation.dining,
        date: { $gte: dayStart, $lt: dayEnd },
        time: effectiveTime,
        status: { $nin: ['cancelled', 'no-show'] },
      });

      const totalGuests = existingReservations.reduce(
        (sum, r) => sum + r.numGuests,
        0
      );

      if (totalGuests + effectiveGuests > dining.maxPeople) {
        const remaining = dining.maxPeople - totalGuests;
        const response: ApiResponse<never> = {
          success: false,
          error: `Not enough seats available. Only ${Math.max(0, remaining)} seat${remaining !== 1 ? 's' : ''} remaining.`,
        };
        return NextResponse.json(response, { status: 409 });
      }
    }

    // Recalculate totalPrice if numGuests changed
    if (filteredUpdates.numGuests) {
      filteredUpdates.totalPrice = dining.price * effectiveGuests;
    }

    const updated = await DiningReservation.findByIdAndUpdate(
      id,
      filteredUpdates,
      { new: true, runValidators: true }
    ).populate('dining');

    const response: ApiResponse<typeof updated> = {
      success: true,
      data: updated,
      message: 'Dining reservation updated successfully',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error updating dining reservation:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to update dining reservation',
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
    const reservation = await DiningReservation.findById(id);

    if (!reservation) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Dining reservation not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    if (reservation.customer !== userId) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Dining reservation not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    if (
      reservation.status === 'cancelled' ||
      reservation.status === 'completed' ||
      reservation.status === 'no-show'
    ) {
      const response: ApiResponse<never> = {
        success: false,
        error: `Cannot cancel a ${reservation.status} reservation`,
      };
      return NextResponse.json(response, { status: 400 });
    }

    await DiningReservation.findByIdAndUpdate(id, { status: 'cancelled' });

    const response: ApiResponse<null> = {
      success: true,
      data: null,
      message: 'Dining reservation cancelled successfully',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error cancelling dining reservation:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to cancel dining reservation',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
