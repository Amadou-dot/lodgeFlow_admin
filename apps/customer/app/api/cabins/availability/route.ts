import { NextRequest, NextResponse } from 'next/server';
import { connectDB, Booking, Cabin } from '@lodgeflow/database';
import { logger } from '@lodgeflow/database/logger';
import type { ApiResponse, AvailableCabin } from '@/types';
import { serializeCabinDetail } from '@lodgeflow/database/cabin-json';
import { cabinAvailabilitySchema } from '@/lib/validations/cabin';
import { readJsonRequestBody } from '@/lib/validations/request-body';

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonRequestBody(request);
    if (!body.success)
      return NextResponse.json(
        { success: false, error: body.error },
        { status: 400 }
      );
    const input = cabinAvailabilitySchema.safeParse(body.data);
    if (!input.success) {
      const response: ApiResponse<never> = {
        success: false,
        error: input.error.issues[0]?.message || 'Invalid availability request',
      };
      return NextResponse.json(response, { status: 400 });
    }
    const { checkInDate: checkIn, checkOutDate: checkOut, guests } = input.data;
    await connectDB();

    // Only the active public catalog can be offered for a new stay.
    const cabins = await Cabin.find({
      status: 'active',
      capacity: { $gte: guests },
    }).sort({ price: 1 });

    // Check availability for each cabin
    const availabilityPromises = cabins.map(async cabin => {
      const conflictingBookings = await Booking.find({
        cabin: cabin._id,
        status: { $nin: ['cancelled'] },
        $or: [
          {
            checkInDate: { $lt: checkOut },
            checkOutDate: { $gt: checkIn },
          },
        ],
      });

      const availableCabin: AvailableCabin = {
        ...serializeCabinDetail(cabin),
        isAvailable: conflictingBookings.length === 0,
        conflictingBookings: conflictingBookings.map(b => b._id.toString()),
      };

      return availableCabin;
    });

    const availableCabins = await Promise.all(availabilityPromises);

    const response: ApiResponse<AvailableCabin[]> = {
      success: true,
      data: availableCabins,
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    logger.error('Error checking availability', error);

    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to check availability',
    };

    return NextResponse.json(response, { status: 500 });
  }
}
