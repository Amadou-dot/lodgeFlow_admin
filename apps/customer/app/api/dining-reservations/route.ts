import { diningReservationQuerySchema } from '@/lib/validations/query-params';
import type { FilterQuery } from 'mongoose';
import type { IDiningReservation } from '@lodgeflow/database/models/DiningReservation';
import { readJsonRequestBody } from '@/lib/validations/request-body';
import { logger } from '@lodgeflow/database/logger';
import {
  serializeDiningReservationDetail,
  serializeDiningReservationHistory,
  type DiningHistorySource,
} from '@lodgeflow/database/reservation-json';
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import {
  connectDB,
  DiningReservation,
  createDiningReservation,
  ReservationRuleError,
} from '@lodgeflow/database';
import type { ApiResponse } from '@/types';
import { createDiningReservationSchema } from '@/lib/validations';
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
      createDiningReservationSchema,
      body.data
    );
    if (!validation.success) return validationErrorResponse(validation.error);
    await connectDB();
    const { diningId, ...selection } = validation.data;
    const data = await createDiningReservation({
      diningId: diningId,
      customerId: userId,
      selection: selection,
    });
    return NextResponse.json(
      {
        success: true,
        data:
          data === null
            ? null
            : serializeDiningReservationDetail(data.toObject()),
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
      .populate('dining', 'name image price type mealType servingTime location')
      .sort({ createdAt: -1 })
      .lean<DiningHistorySource[]>();

    const response: ApiResponse<
      ReturnType<typeof serializeDiningReservationHistory>[]
    > = {
      success: true,
      data: reservations.map(serializeDiningReservationHistory),
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    logger.error('Error fetching dining reservations:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to fetch dining reservations',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
