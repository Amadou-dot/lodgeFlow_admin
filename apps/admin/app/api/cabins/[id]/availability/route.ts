import { requireApiAuth } from '@/lib/api-utils';
import connectDB from '@/lib/mongodb';
import Booking from '@/models/Booking';
import mongoose from 'mongoose';
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
  const authResult = await requireApiAuth();
  if (!authResult.authenticated) return authResult.error;

  try {
    await connectDB();

    const { id: cabinId } = await context.params;
    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const excludeBookingId = url.searchParams.get('excludeBookingId');

    // Default to next 6 months if no date range provided
    const defaultStart = new Date();
    const defaultEnd = new Date();
    defaultEnd.setMonth(defaultEnd.getMonth() + 6);

    const queryStartDate = startDate ? new Date(startDate) : defaultStart;
    const queryEndDate = endDate ? new Date(endDate) : defaultEnd;

    // Find all bookings that overlap with the query date range
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: Record<string, any> = {
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
    if (excludeBookingId) {
      if (!mongoose.Types.ObjectId.isValid(excludeBookingId)) {
        return NextResponse.json(
          { success: false, error: 'Invalid excludeBookingId format' },
          { status: 400 }
        );
      }
      query._id = { $ne: new mongoose.Types.ObjectId(excludeBookingId) };
    }

    const bookings = await Booking.find(query)
      .select('checkInDate checkOutDate')
      .lean();

    // Create array of unavailable date ranges
    const unavailableDates = (bookings as unknown as BookingDateRange[]).map(
      booking => ({
        start: booking.checkInDate.toISOString().split('T')[0],
        end: booking.checkOutDate.toISOString().split('T')[0],
      })
    );

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
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch cabin availability',
      },
      { status: 500 }
    );
  }
}
