import { requireApiAuth } from '@/lib/api-utils';
import connectDB from '@/lib/mongodb';
import Booking from '@lodgeflow/database/models/Booking';
import mongoose, { type FilterQuery } from 'mongoose';
import type { IBooking } from '@lodgeflow/database/models/Booking';
import { cabinAvailabilityQuerySchema } from '@/lib/validations/cabin-availability';
import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';

interface BookingDateRange {
  checkInDate: Date;
  checkOutDate: Date;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Require authentication
  const authResult = await requireApiAuth({ permission: 'bookings:read' });
  if (!authResult.authenticated) return authResult.error;

  try {
    const { id: cabinId } = await context.params;
    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const excludeBookingId = url.searchParams.get('excludeBookingId');

    // Default to next 6 months if no date range provided
    const defaultStart = new Date();
    const defaultEnd = new Date();
    defaultEnd.setMonth(defaultEnd.getMonth() + 6);

    const parsed = cabinAvailabilityQuerySchema.safeParse({
      cabinId,
      excludeBookingId: excludeBookingId || undefined,
      startDate: startDate || defaultStart.toISOString(),
      endDate: endDate || defaultEnd.toISOString(),
    });
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }
    const { startDate: queryStartDate, endDate: queryEndDate } = parsed.data;
    await connectDB();

    // Find all bookings that overlap with the query date range
    const query: FilterQuery<IBooking> = {
      cabin: cabinId,
      status: { $nin: ['cancelled'] },
      $or: [
        {
          checkInDate: { $lt: queryEndDate },
          checkOutDate: { $gt: queryStartDate },
        },
      ],
    };

    // When editing a booking, exclude its own dates from the unavailable list
    if (parsed.data.excludeBookingId) {
      query._id = {
        $ne: new mongoose.Types.ObjectId(parsed.data.excludeBookingId),
      };
    }

    const bookings = await Booking.find(query)
      .select('checkInDate checkOutDate')
      .lean<BookingDateRange[]>();

    // Create array of unavailable date ranges
    const unavailableDates = bookings.map(booking => ({
      start: booking.checkInDate.toISOString().split('T')[0],
      end: booking.checkOutDate.toISOString().split('T')[0],
    }));

    return NextResponse.json({
      success: true,
      data: {
        cabinId,
        unavailableDates,
        queryRange: {
          start: queryStartDate.toISOString().split('T')[0],
          end: queryEndDate.toISOString().split('T')[0],
        },
      },
    });
  } catch (error: unknown) {
    logger.error('Failed to fetch cabin availability', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch cabin availability',
      },
      { status: 500 }
    );
  }
}
