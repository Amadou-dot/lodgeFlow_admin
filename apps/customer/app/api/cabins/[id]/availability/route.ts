import { connectDB, Booking, Cabin } from '@lodgeflow/database';
import { logger } from '@lodgeflow/database/logger';
import {
  cabinCalendarQuerySchema,
  cabinIdSchema,
} from '@/lib/validations/cabin';
import type { ApiResponse } from '@/types';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cabinId } = await context.params;
    if (!cabinIdSchema.safeParse(cabinId).success)
      return NextResponse.json(
        { success: false, error: 'Invalid cabin ID' },
        { status: 400 }
      );

    const { searchParams } = new URL(request.url);
    const input = cabinCalendarQuerySchema.safeParse({
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    });
    if (!input.success)
      return NextResponse.json(
        {
          success: false,
          error:
            input.error.issues[0]?.message || 'Invalid availability date range',
        },
        { status: 400 }
      );
    const { startDate: queryStartDate, endDate: queryEndDate } = input.data;
    await connectDB();

    // Verify cabin exists and is active
    const cabin = await Cabin.findById(cabinId);
    if (!cabin || (cabin.status && cabin.status !== 'active')) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Cabin not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    // Find all bookings that overlap with the query date range
    const bookings = await Booking.findOverlapping({
      cabinId,
      checkInDate: queryStartDate,
      checkOutDate: queryEndDate,
    });

    // Create array of unavailable date ranges
    const unavailableDates = bookings.map(booking => ({
      start: booking.checkInDate.toISOString().split('T')[0],
      end: booking.checkOutDate.toISOString().split('T')[0],
    }));

    return NextResponse.json({
      success: true,
      data: {
        cabinId,
        unavailableDates,
        queryRange: {
          start: queryStartDate.toISOString().split('T')[0],
          end: queryEndDate.toISOString().split('T')[0],
        },
      },
    });
  } catch (error: unknown) {
    logger.error('Error fetching cabin availability', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch cabin availability',
      },
      { status: 500 }
    );
  }
}
