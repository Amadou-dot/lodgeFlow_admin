import { auth } from '@clerk/nextjs/server';
import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import { connectDB, Dining, DiningReservation } from '@/models';
import type { ApiResponse } from '@/types';
import { createDiningReservationSchema } from '@/lib/validations';
import {
  validateRequest,
  validationErrorResponse,
} from '@/lib/validations/utils';

class CapacityExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CapacityExceededError';
  }
}

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

    const body = await request.json();

    // Validate request body with Zod
    const validation = validateRequest(createDiningReservationSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const {
      diningId,
      date,
      time,
      numGuests,
      dietaryRequirements,
      specialRequests,
      tablePreference,
      occasion,
    } = validation.data;

    const reservationDate = new Date(date);
    const guests = numGuests;

    const dining = await Dining.findById(diningId);
    if (!dining) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Dining item not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    // Validate guest count against maxPeople
    if (guests > dining.maxPeople) {
      const response: ApiResponse<never> = {
        success: false,
        error: `Maximum ${dining.maxPeople} guests allowed for this dining option`,
      };
      return NextResponse.json(response, { status: 400 });
    }

    if (guests < dining.minPeople) {
      const response: ApiResponse<never> = {
        success: false,
        error: `Minimum ${dining.minPeople} guests required for this dining option`,
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Validate time is within serving time
    const [reqHour, reqMin] = time.split(':').map(Number);
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

    const totalPrice = dining.price * guests;

    const dayStart = new Date(reservationDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(reservationDate);
    dayEnd.setHours(23, 59, 59, 999);

    // Use a transaction to atomically create and verify capacity
    const session = await mongoose.startSession();
    let reservationId: string;

    try {
      await session.withTransaction(async () => {
        const [created] = await DiningReservation.create(
          [
            {
              dining: diningId,
              customer: userId,
              date: reservationDate,
              time,
              numGuests: guests,
              status: 'pending',
              totalPrice,
              isPaid: false,
              dietaryRequirements,
              specialRequests,
              tablePreference,
              occasion,
            },
          ],
          { session }
        );

        reservationId = created._id.toString();

        // Check capacity within the same transaction
        const allReservations = await DiningReservation.find(
          {
            dining: diningId,
            date: { $gte: dayStart, $lt: dayEnd },
            time,
            status: { $nin: ['cancelled', 'no-show'] },
          },
          null,
          { session }
        );

        const totalGuests = allReservations.reduce(
          (sum, r) => sum + r.numGuests,
          0
        );

        if (totalGuests > dining.maxPeople) {
          const remaining = dining.maxPeople - (totalGuests - guests);
          throw new CapacityExceededError(
            `Not enough seats available at this time. Only ${Math.max(0, remaining)} seat${remaining !== 1 ? 's' : ''} remaining.`
          );
        }
      });
    } catch (err) {
      session.endSession();
      if (err instanceof CapacityExceededError) {
        const response: ApiResponse<never> = {
          success: false,
          error: err.message,
        };
        return NextResponse.json(response, { status: 409 });
      }
      throw err;
    }

    session.endSession();

    const populatedReservation = await DiningReservation.findById(
      reservationId!
    ).populate('dining');

    const response: ApiResponse<typeof populatedReservation> = {
      success: true,
      data: populatedReservation,
      message: 'Dining reservation created successfully',
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating dining reservation:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to create dining reservation',
    };
    return NextResponse.json(response, { status: 500 });
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

    const reservations = await DiningReservation.find(query)
      .populate('dining', 'name image price type mealType servingTime location')
      .sort({ createdAt: -1 })
      .lean();

    const response: ApiResponse<typeof reservations> = {
      success: true,
      data: reservations,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching dining reservations:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to fetch dining reservations',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
