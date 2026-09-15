import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

import { connectDB, Experience, ExperienceBooking } from '@/models';
import type { ApiResponse } from '@/types';
import { createExperienceBookingSchema } from '@/lib/validations';
import {
  validateRequest,
  validationErrorResponse,
} from '@/lib/validations/utils';

export async function POST(request: NextRequest) {
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

    const body = await request.json();

    // Validate request body with Zod
    const validation = validateRequest(createExperienceBookingSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const {
      experienceId,
      date,
      timeSlot,
      numParticipants,
      specialRequests,
      observations,
    } = validation.data;

    const bookingDate = new Date(date);
    const participants = numParticipants;

    const experience = await Experience.findById(experienceId);
    if (!experience) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Experience not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    // Validate capacity
    if (experience.maxParticipants) {
      if (participants > experience.maxParticipants) {
        const response: ApiResponse<never> = {
          success: false,
          error: `Maximum ${experience.maxParticipants} participants allowed`,
        };
        return NextResponse.json(response, { status: 400 });
      }

      const dayStart = new Date(bookingDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(bookingDate);
      dayEnd.setHours(23, 59, 59, 999);

      const existingBookings = await ExperienceBooking.find({
        experience: experienceId,
        date: { $gte: dayStart, $lt: dayEnd },
        status: { $nin: ['cancelled'] },
      });

      const totalParticipants = existingBookings.reduce(
        (sum, b) => sum + b.numParticipants,
        0
      );

      if (totalParticipants + participants > experience.maxParticipants) {
        const remaining = experience.maxParticipants - totalParticipants;
        const response: ApiResponse<never> = {
          success: false,
          error: `Not enough spots available. Only ${remaining} spot${remaining !== 1 ? 's' : ''} remaining.`,
        };
        return NextResponse.json(response, { status: 409 });
      }
    }

    const totalPrice = experience.price * participants;

    const booking = await ExperienceBooking.create({
      experience: experienceId,
      customer: userId,
      date: bookingDate,
      timeSlot,
      numParticipants: participants,
      status: 'pending',
      totalPrice,
      isPaid: false,
      specialRequests,
      observations,
    });

    const populatedBooking = await ExperienceBooking.findById(
      booking._id
    ).populate('experience');

    const response: ApiResponse<typeof populatedBooking> = {
      success: true,
      data: populatedBooking,
      message: 'Experience booking created successfully',
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating experience booking:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to create experience booking',
    };
    return NextResponse.json(response, { status: 500 });
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

    const bookings = await ExperienceBooking.find(query)
      .populate('experience', 'name image price duration category')
      .sort({ createdAt: -1 })
      .lean();

    const response: ApiResponse<typeof bookings> = {
      success: true,
      data: bookings,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching experience bookings:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to fetch experience bookings',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
