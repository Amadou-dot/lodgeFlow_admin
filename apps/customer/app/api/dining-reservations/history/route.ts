import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

import { connectDB, DiningReservation } from '@/models';
import type { ApiResponse } from '@/types';

/**
 * GET /api/dining-reservations/history
 * Fetch dining reservation history for the authenticated user
 * Query params: status (optional) - filter by reservation status
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

    const reservations = await DiningReservation.find(query)
      .populate(
        'dining',
        'name image price type mealType servingTime location maxPeople'
      )
      .sort({ createdAt: -1 })
      .lean();

    const response: ApiResponse<typeof reservations> = {
      success: true,
      data: reservations,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error fetching dining reservation history:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to fetch dining reservation history',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
