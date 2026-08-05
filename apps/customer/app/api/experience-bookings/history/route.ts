import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

import { connectDB, ExperienceBooking } from '@/models';
import type { ApiResponse } from '@/types';

/**
 * GET /api/experience-bookings/history
 * Fetch experience booking history for the authenticated user
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

    const query: Record<string, unknown> = { customer: userId };
    if (status) {
      query.status = status;
    }

    const bookings = await ExperienceBooking.find(query)
      .populate('experience', 'name image price duration category location')
      .sort({ createdAt: -1 })
      .lean();

    const response: ApiResponse<typeof bookings> = {
      success: true,
      data: bookings,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error fetching experience booking history:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to fetch experience booking history',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
