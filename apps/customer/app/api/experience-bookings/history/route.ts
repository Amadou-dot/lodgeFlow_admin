import { experienceBookingQuerySchema } from '@/lib/validations/query-params';
import type { FilterQuery } from 'mongoose';
import type { IExperienceBooking } from '@lodgeflow/database/models/ExperienceBooking';
import { logger } from '@lodgeflow/database/logger';
import {
  serializeExperienceReservationHistory,
  type ExperienceHistorySource,
} from '@lodgeflow/database/reservation-json';
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

import { connectDB, ExperienceBooking } from '@lodgeflow/database';
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

    const { searchParams } = new URL(request.url);
    const parsed = experienceBookingQuerySchema
      .pick({ status: true })
      .safeParse({ status: searchParams.get('status') || undefined });
    if (!parsed.success)
      return NextResponse.json(
        { success: false, error: 'Invalid reservation status' },
        { status: 400 }
      );
    const query: FilterQuery<IExperienceBooking> = { customer: userId };
    if (parsed.data.status) query.status = parsed.data.status;
    await connectDB();

    const bookings = await ExperienceBooking.find(query)
      .populate('experience', 'name image price duration category location')
      .sort({ createdAt: -1 })
      .lean<ExperienceHistorySource[]>();

    const response: ApiResponse<
      ReturnType<typeof serializeExperienceReservationHistory>[]
    > = {
      success: true,
      data: bookings.map(serializeExperienceReservationHistory),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: unknown) {
    logger.error('Error fetching experience booking history:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to fetch experience booking history',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
