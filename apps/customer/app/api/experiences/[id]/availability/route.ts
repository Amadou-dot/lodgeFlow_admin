import { NextRequest, NextResponse } from 'next/server';

import { connectDB, Experience, ExperienceBooking } from '@/models';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    const { id: experienceId } = await context.params;
    const url = new URL(request.url);
    const dateParam = url.searchParams.get('date');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    const experience = await Experience.findById(experienceId);
    if (!experience) {
      return NextResponse.json(
        { success: false, error: 'Experience not found' },
        { status: 404 }
      );
    }

    // If checking a specific date
    if (dateParam) {
      const checkDate = new Date(dateParam);
      if (isNaN(checkDate.getTime())) {
        return NextResponse.json(
          { success: false, error: 'Invalid date parameter' },
          { status: 400 }
        );
      }

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

      return NextResponse.json({
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

    return NextResponse.json({
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
    console.error('Error fetching experience availability:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch experience availability' },
      { status: 500 }
    );
  }
}
