import type {
  ExperienceDayAvailability,
  ExperienceRangeAvailability,
} from '@/types/reservation-availability';
import { logger } from '@lodgeflow/database/logger';
import { catalogIdSchema } from '@/lib/validations/catalog';
import { reservationAvailabilityQuerySchema } from '@/lib/validations/reservation-availability';
import { NextRequest, NextResponse } from 'next/server';

import { connectDB, Experience, ExperienceBooking } from '@lodgeflow/database';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: experienceId } = await context.params;
    const url = new URL(request.url);
    if (!catalogIdSchema.safeParse(experienceId).success)
      return NextResponse.json(
        { success: false, error: 'Experience not found' },
        { status: 404 }
      );
    const parsed = reservationAvailabilityQuerySchema.safeParse({
      date: url.searchParams.get('date') || undefined,
      time: undefined,
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

    const experience = await Experience.findById(experienceId);
    if (!experience) {
      return NextResponse.json(
        { success: false, error: 'Experience not found' },
        { status: 404 }
      );
    }

    // If checking a specific date
    if (selection.kind === 'day') {
      const { dateParam, checkDate } = selection;

      const dayStart = new Date(checkDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(checkDate);
      dayEnd.setHours(23, 59, 59, 999);

      const bookings = await ExperienceBooking.find({
        experience: experienceId,
        date: { $gte: dayStart, $lt: dayEnd },
        status: { $nin: ['cancelled'] },
      }).lean();

      const totalParticipants = bookings.reduce(
        (sum, b) => sum + b.numParticipants,
        0
      );

      const maxParticipants = experience.maxParticipants || Infinity;
      const spotsRemaining = Math.max(0, maxParticipants - totalParticipants);

      return NextResponse.json<{
        success: true;
        data: ExperienceDayAvailability;
      }>({
        success: true,
        data: {
          experienceId,
          date: dateParam,
          spotsRemaining,
          maxParticipants: experience.maxParticipants || null,
          isAvailable: spotsRemaining > 0,
        },
      });
    }

    const { queryStart, queryEnd } = selection;

    const bookings = await ExperienceBooking.find({
      experience: experienceId,
      date: { $gte: queryStart, $lte: queryEnd },
      status: { $nin: ['cancelled'] },
    })
      .select('date numParticipants')
      .lean();

    // Group by date and calculate availability
    const dateMap = new Map<string, number>();
    for (const booking of bookings) {
      const dateKey = new Date(booking.date).toISOString().split('T')[0];
      dateMap.set(
        dateKey,
        (dateMap.get(dateKey) || 0) + booking.numParticipants
      );
    }

    const maxParticipants = experience.maxParticipants || Infinity;
    const fullyBookedDates: string[] = [];

    dateMap.forEach((participants, dateKey) => {
      if (participants >= maxParticipants) {
        fullyBookedDates.push(dateKey);
      }
    });

    return NextResponse.json<{
      success: true;
      data: ExperienceRangeAvailability;
    }>({
      success: true,
      data: {
        experienceId,
        fullyBookedDates,
        maxParticipants: experience.maxParticipants || null,
        availableDays: experience.available,
        queryRange: {
          start: queryStart.toISOString().split('T')[0],
          end: queryEnd.toISOString().split('T')[0],
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching experience availability:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch experience availability' },
      { status: 500 }
    );
  }
}
