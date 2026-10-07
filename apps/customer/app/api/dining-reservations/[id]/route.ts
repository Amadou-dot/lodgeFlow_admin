import { reservationIdSchema } from '@/lib/validations/reservation-id';
import { readJsonRequestBody } from '@/lib/validations/request-body';
import { logger } from '@lodgeflow/database/logger';
import { serializeDiningReservationDetail } from '@lodgeflow/database/reservation-json';
import type { DiningJsonSource } from '@lodgeflow/database/dining-json';
import {
  updateDiningReservation,
  ReservationRuleError,
} from '@lodgeflow/database';
import { updateDiningDetailsSchema } from '@/lib/validations/dining-reservation';
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

import { connectDB, DiningReservation } from '@lodgeflow/database';
import type { ApiResponse } from '@/types';

type Params = Promise<{ id: string }>;

export async function GET(
  _request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Authentication required',
      };
      return NextResponse.json(response, { status: 401 });
    }

    const { id } = await params;
    if (!reservationIdSchema.safeParse(id).success)
      return NextResponse.json(
        { success: false, error: 'Dining reservation not found' },
        { status: 404 }
      );
    await connectDB();
    const reservation = await DiningReservation.findById(id).populate<{
      dining: DiningJsonSource | null;
    }>('dining');

    if (!reservation) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Dining reservation not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    if (reservation.customer !== userId) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Dining reservation not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    const response: ApiResponse<
      ReturnType<typeof serializeDiningReservationDetail>
    > = {
      success: true,
      data: serializeDiningReservationDetail(reservation.toObject()),
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    logger.error('Error fetching dining reservation:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to fetch dining reservation',
    };
    return NextResponse.json(response, { status: 500 });
  }
}

async function change({
  request,
  params,
  action,
}: {
  request: NextRequest;
  params: Params;
  action: 'update' | 'cancel';
}) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    const body =
      action === 'cancel'
        ? { success: true as const, data: {} }
        : await readJsonRequestBody(request);
    if (!body.success)
      return NextResponse.json(
        { success: false, error: body.error },
        { status: 400 }
      );
    const parsed = updateDiningDetailsSchema.safeParse(body.data);
    if (!parsed.success)
      return NextResponse.json(
        { success: false, error: 'Invalid reservation details' },
        { status: 400 }
      );
    const { id } = await params;
    if (!reservationIdSchema.safeParse(id).success)
      return NextResponse.json(
        { success: false, error: 'Reservation or listing not found' },
        { status: 404 }
      );
    await connectDB();
    const data = await updateDiningReservation({
      reservationId: id,
      customerId: userId,
      ...(action === 'cancel' ? { action } : { action, updates: parsed.data }),
    });
    return NextResponse.json({
      success: true,
      data:
        data === null
          ? null
          : serializeDiningReservationDetail(data.toObject()),
      message:
        action === 'cancel'
          ? 'Reservation cancelled successfully'
          : 'Reservation updated successfully',
    });
  } catch (error: unknown) {
    if (error instanceof ReservationRuleError)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    logger.error('Failed to change reservation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to change reservation' },
      { status: 500 }
    );
  }
}
export async function PATCH(
  request: NextRequest,
  { params }: { params: Params }
) {
  return change({ request, params, action: 'update' });
}
export async function DELETE(
  request: NextRequest,
  { params }: { params: Params }
) {
  return change({ request, params, action: 'cancel' });
}
