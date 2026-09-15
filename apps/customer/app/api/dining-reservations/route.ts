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
    const validation = validateRequest(
      createDiningReservationSchema,
      await request.json()
    );
    if (!validation.success) return validationErrorResponse(validation.error);
    await connectDB();
    const { diningId, ...selection } = validation.data;
    const data = await createDiningReservation(diningId, userId, selection);
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    if (error instanceof ReservationRuleError)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    console.error('Failed to create reservation:', error);
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

    await connectDB();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const query: Record<string, unknown> = { customer: userId };
    if (status) {
      query.status = status;
    }

    const reservations = await DiningReservation.find(query)
      .populate('dining', 'name image price type mealType servingTime location')
      .sort({ createdAt: -1 })
      .lean();

    const response: ApiResponse<typeof reservations> = {
      success: true,
      data: reservations,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching dining reservations:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to fetch dining reservations',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
