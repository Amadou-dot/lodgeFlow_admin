import { experienceBookingQuerySchema } from '@/lib/validations/query-params';
import type { FilterQuery } from 'mongoose';
import type { IExperienceBooking } from '@lodgeflow/database/models/ExperienceBooking';
import { readJsonRequestBody } from '@/lib/validations/request-body';
import { logger } from '@lodgeflow/database/logger';
import {
  serializeExperienceReservationDetail,
  serializeExperienceReservationHistory,
  type ExperienceHistorySource,
} from '@lodgeflow/database/reservation-json';
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import {
  connectDB,
  ExperienceBooking,
  createExperienceReservation,
  ReservationRuleError,
} from '@lodgeflow/database';
import type { ApiResponse } from '@/types';
import { createExperienceBookingSchema } from '@/lib/validations';
import {
  validateRequest,
  validationErrorResponse,
} from '@/lib/validations/utils';
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    const body = await readJsonRequestBody(request);
    if (!body.success) return validationErrorResponse(body.error);
    const validation = validateRequest(
      createExperienceBookingSchema,
      body.data
    );
    if (!validation.success) return validationErrorResponse(validation.error);
    await connectDB();
    const { experienceId, ...selection } = validation.data;
    const data = await createExperienceReservation({
      experienceId: experienceId,
      customerId: userId,
      selection: selection,
    });
    return NextResponse.json(
      {
        success: true,
        data:
          data === null
            ? null
            : serializeExperienceReservationDetail(data.toObject()),
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof ReservationRuleError)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    logger.error('Failed to create reservation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create reservation' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Authentication required',
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
      .populate('experience', 'name image price duration category')
      .sort({ createdAt: -1 })
      .lean<ExperienceHistorySource[]>();

    const response: ApiResponse<
      ReturnType<typeof serializeExperienceReservationHistory>[]
    > = {
      success: true,
      data: bookings.map(serializeExperienceReservationHistory),
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    logger.error('Error fetching experience bookings:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to fetch experience bookings',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
