import { NextRequest, NextResponse } from 'next/server';

import { connectDB, Dining, DiningReservation } from '@/models';

/**
 * Validates HH:MM time format
 */
function isValidTimeFormat(time: string): boolean {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return timeRegex.test(time);
}

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
function isWithinServingWindow(
  time: string,
  servingStart: string,
  servingEnd: string
): boolean {
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
    await connectDB();

    const { id: diningId } = await context.params;
    const url = new URL(request.url);
    const dateParam = url.searchParams.get('date');
    const timeParam = url.searchParams.get('time');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    const dining = await Dining.findById(diningId);
    if (!dining) {
      return NextResponse.json(
        { success: false, error: 'Dining item not found' },
        { status: 404 }
      );
    }

    // If checking a specific date (and optionally time)
    if (dateParam) {
      const checkDate = new Date(dateParam);
      if (isNaN(checkDate.getTime())) {
        return NextResponse.json(
          { success: false, error: 'Invalid date parameter' },
          { status: 400 }
        );
      }

      // Validate time format and serving window if time is provided
      if (timeParam) {
        if (!isValidTimeFormat(timeParam)) {
          return NextResponse.json(
            {
              success: false,
              error: 'Invalid time format. Expected HH:MM (e.g., 14:30)',
            },
            { status: 400 }
          );
        }

        if (
          !isWithinServingWindow(
            timeParam,
            dining.servingTime.start,
            dining.servingTime.end
          )
        ) {
          return NextResponse.json({
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

      const query: Record<string, unknown> = {
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

      return NextResponse.json({
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

    // If checking a date range (for calendar display)
    const defaultStart = new Date();
    const defaultEnd = new Date();
    defaultEnd.setMonth(defaultEnd.getMonth() + 3);

    const queryStart = startDate ? new Date(startDate) : defaultStart;
    let queryEnd = endDate ? new Date(endDate) : defaultEnd;

    if (isNaN(queryStart.getTime()) || isNaN(queryEnd.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid date range parameters' },
        { status: 400 }
      );
    }

    // Clamp range to maximum 6 months to prevent heavy queries
    const maxRangeMs = 6 * 30 * 24 * 60 * 60 * 1000; // ~6 months
    if (queryEnd.getTime() - queryStart.getTime() > maxRangeMs) {
      queryEnd = new Date(queryStart.getTime() + maxRangeMs);
    }

    if (queryEnd <= queryStart) {
      return NextResponse.json(
        { success: false, error: 'End date must be after start date' },
        { status: 400 }
      );
    }

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

    return NextResponse.json({
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
    console.error('Error fetching dining availability:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dining availability' },
      { status: 500 }
    );
  }
}
