import { NextRequest, NextResponse } from 'next/server';
import { connectDB, Booking, Cabin } from '@/models';
import type { ApiResponse, AvailableCabin, AvailabilityQuery } from '@/types';

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body: AvailabilityQuery = await request.json();
    const { checkInDate, checkOutDate, guests } = body;

    if (!checkInDate || !checkOutDate || !guests) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Missing required fields: checkInDate, checkOutDate, guests',
      };
      return NextResponse.json(response, { status: 400 });
    }

    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);

    if (checkIn >= checkOut) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Check-out date must be after check-in date',
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Find cabins that can accommodate the guests
    const cabins = await Cabin.find({ capacity: { $gte: guests } }).sort({
      price: 1,
    });

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
        ...cabin.toObject(),
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
  } catch (error) {
    console.error('Error checking availability:', error);

    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to check availability',
    };

    return NextResponse.json(response, { status: 500 });
  }
}
