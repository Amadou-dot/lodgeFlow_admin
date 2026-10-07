import { diningReservationQuerySchema } from '@/lib/validations/query-params';
import type { FilterQuery } from 'mongoose';
import type { IDiningReservation } from '@lodgeflow/database/models/DiningReservation';
import { logger } from '@lodgeflow/database/logger';
import {
  serializeDiningReservationHistory,
  type DiningHistorySource,
} from '@lodgeflow/database/reservation-json';
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

import { connectDB, DiningReservation } from '@lodgeflow/database';
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

    const { searchParams } = new URL(request.url);
    const parsed = diningReservationQuerySchema
      .pick({ status: true })
      .safeParse({ status: searchParams.get('status') || undefined });
    if (!parsed.success)
      return NextResponse.json(
        { success: false, error: 'Invalid reservation status' },
        { status: 400 }
      );
    const query: FilterQuery<IDiningReservation> = { customer: userId };
    if (parsed.data.status) query.status = parsed.data.status;
    await connectDB();

    const reservations = await DiningReservation.find(query)
      .populate(
        'dining',
        'name image price type mealType servingTime location maxPeople'
      )
      .sort({ createdAt: -1 })
      .lean<DiningHistorySource[]>();

    const response: ApiResponse<
      ReturnType<typeof serializeDiningReservationHistory>[]
    > = {
      success: true,
      data: reservations.map(serializeDiningReservationHistory),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: unknown) {
    logger.error('Error fetching dining reservation history:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to fetch dining reservation history',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
