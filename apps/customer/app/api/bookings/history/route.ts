import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

import { Booking, connectDB } from '@/models';
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
    const query: any = { customer: userId };
    if (status) {
      query.status = status;
    }

    // Fetch bookings with cabin details
    const bookings = await Booking.find(query)
      .populate(
        'cabin',
        'name image images capacity price discount description status bedrooms bathrooms size minNights'
      )
      .sort({ createdAt: -1 })
      .lean();

    const response: ApiResponse<typeof bookings> = {
      success: true,
      data: bookings,
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
