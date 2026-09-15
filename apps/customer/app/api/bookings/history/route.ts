import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

import { Booking, connectDB } from '@lodgeflow/database';
import type { BookingHistoryItem } from '@/types/booking-read';
import {
  serializeBookingHistory,
  type HistoryCabinSource,
} from '@/lib/serializers/booking-read';
import type { FilterQuery } from 'mongoose';
import type { IBooking } from '@lodgeflow/database/models/Booking';
import type { ApiResponse } from '@/types';

/**
 * GET /api/bookings/history
 * Fetch booking history for the authenticated user
 * Query params: status (optional) - filter by booking status
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Unauthorized',
      };
      return NextResponse.json(response, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    // Build query
    const query: FilterQuery<IBooking> = { customer: userId };
    if (status) {
      query.status = status;
    }

    // Fetch bookings with cabin details
    const bookings = await Booking.find(query)
      .populate<{ cabin: HistoryCabinSource | null }>(
        'cabin',
        'name image images capacity price discount description status bedrooms bathrooms size minNights'
      )
      .sort({ createdAt: -1 })
      .lean();

    const response: ApiResponse<BookingHistoryItem[]> = {
      success: true,
      data: bookings.map(serializeBookingHistory),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error fetching booking history:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to fetch booking history',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
