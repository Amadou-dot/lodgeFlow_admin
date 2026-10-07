import type {
  DiningDayAvailability,
  DiningRangeAvailability,
} from '@/types/reservation-availability';
import type { FilterQuery } from 'mongoose';
import type { IDiningReservation } from '@lodgeflow/database/models/DiningReservation';
import { logger } from '@lodgeflow/database/logger';
import { catalogIdSchema } from '@/lib/validations/catalog';
import { reservationAvailabilityQuerySchema } from '@/lib/validations/reservation-availability';
import { NextRequest, NextResponse } from 'next/server';

import { connectDB, Dining, DiningReservation } from '@lodgeflow/database';

/**
 * Converts HH:MM to minutes since midnight for comparison
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Checks if a time falls within the serving window
 */
function isWithinServingWindow({
  time,
  servingStart,
  servingEnd,
}: {
  time: string;
  servingStart: string;
  servingEnd: string;
}): boolean {
  const timeMinutes = timeToMinutes(time);
  const startMinutes = timeToMinutes(servingStart);
  const endMinutes = timeToMinutes(servingEnd);
  return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: diningId } = await context.params;
    const url = new URL(request.url);
    if (!catalogIdSchema.safeParse(diningId).success)
      return NextResponse.json(
        { success: false, error: 'Dining item not found' },
        { status: 404 }
      );
    const parsed = reservationAvailabilityQuerySchema.safeParse({
      date: url.searchParams.get('date') || undefined,
      time: url.searchParams.get('time') || undefined,
      startDate: url.searchParams.get('startDate') || undefined,
      endDate: url.searchParams.get('endDate') || undefined,
    });
    if (!parsed.success)
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      );
    const selection = parsed.data;
    await connectDB();

    const dining = await Dining.findById(diningId);
    if (!dining) {
      return NextResponse.json(
        { success: false, error: 'Dining item not found' },
        { status: 404 }
      );
    }

    // If checking a specific date (and optionally time)
    if (selection.kind === 'day') {
      const { dateParam, checkDate, timeParam } = selection;
      if (timeParam) {
        if (
          !isWithinServingWindow({
            time: timeParam,
            servingStart: dining.servingTime.start,
            servingEnd: dining.servingTime.end,
          })
        ) {
          return NextResponse.json<{
            success: true;
            data: DiningDayAvailability;
          }>({
            success: true,
            data: {
              diningId,
              date: dateParam,
              time: timeParam,
              seatsRemaining: 0,
              maxPeople: dining.maxPeople || null,
              isAvailable: false,
              servingTime: dining.servingTime,
              reason: `Time ${timeParam} is outside serving hours (${dining.servingTime.start} - ${dining.servingTime.end})`,
            },
          });
        }
      }

      const dayStart = new Date(checkDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(checkDate);
      dayEnd.setHours(23, 59, 59, 999);

      const query: FilterQuery<IDiningReservation> = {
        dining: diningId,
        date: { $gte: dayStart, $lt: dayEnd },
        status: { $nin: ['cancelled', 'no-show'] },
      };

      // If time is specified, filter by time slot
      if (timeParam) {
        query.time = timeParam;
      }

      const reservations = await DiningReservation.find(query).lean();

      const totalGuests = reservations.reduce((sum, r) => sum + r.numGuests, 0);

      const maxPeople = dining.maxPeople || Infinity;
      const seatsRemaining = Math.max(0, maxPeople - totalGuests);

      return NextResponse.json<{ success: true; data: DiningDayAvailability }>({
        success: true,
        data: {
          diningId,
          date: dateParam,
          time: timeParam || null,
          seatsRemaining,
          maxPeople: dining.maxPeople || null,
          isAvailable: seatsRemaining > 0,
          servingTime: dining.servingTime,
        },
      });
    }

    const { queryStart, queryEnd } = selection;

    const reservations = await DiningReservation.find({
      dining: diningId,
      date: { $gte: queryStart, $lte: queryEnd },
      status: { $nin: ['cancelled', 'no-show'] },
    })
      .select('date time numGuests')
      .lean();

    // Group by date and calculate availability
    const dateMap = new Map<string, number>();
    for (const reservation of reservations) {
      const dateKey = new Date(reservation.date).toISOString().split('T')[0];
      dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + reservation.numGuests);
    }

    const maxPeople = dining.maxPeople || Infinity;
    const fullyBookedDates: string[] = [];

    dateMap.forEach((guests, dateKey) => {
      if (guests >= maxPeople) {
        fullyBookedDates.push(dateKey);
      }
    });

    return NextResponse.json<{ success: true; data: DiningRangeAvailability }>({
      success: true,
      data: {
        diningId,
        fullyBookedDates,
        maxPeople: dining.maxPeople || null,
        servingTime: dining.servingTime,
        queryRange: {
          start: queryStart.toISOString().split('T')[0],
          end: queryEnd.toISOString().split('T')[0],
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching dining availability:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dining availability' },
      { status: 500 }
    );
  }
}
