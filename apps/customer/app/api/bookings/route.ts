import { Booking, Cabin, connectDB, Settings } from '@/models';
import type { ApiResponse, PopulatedBooking } from '@/types';
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createBookingSchema } from '@/lib/validations';
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
        error: 'Unauthorized',
      };
      return NextResponse.json(response, { status: 401 });
    }

    await connectDB();

    const body = await request.json();

    // Validate request body with Zod
    const validation = validateRequest(createBookingSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const {
      cabinId,
      checkInDate,
      checkOutDate,
      numGuests,
      extras,
      specialRequests,
      observations,
    } = validation.data;

    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);

    // Check if cabin exists and is active
    const cabin = await Cabin.findById(cabinId);
    if (!cabin) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Cabin not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    if (cabin.status && cabin.status !== 'active') {
      const response: ApiResponse<never> = {
        success: false,
        error: 'This cabin is not available for booking',
      };
      return NextResponse.json(response, { status: 400 });
    }

    if (numGuests > cabin.capacity) {
      const response: ApiResponse<never> = {
        success: false,
        error: `Cabin capacity exceeded. Maximum guests: ${cabin.capacity}`,
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Check for conflicting bookings
    const conflictingBookings = await Booking.findOverlapping(
      cabinId,
      checkIn,
      checkOut
    );

    if (conflictingBookings.length > 0) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Cabin is not available for the selected dates',
      };
      return NextResponse.json(response, { status: 409 });
    }

    // Get settings for pricing
    const settings = await Settings.getSettings();

    // Calculate nights and pricing
    const numNights = Math.ceil(
      (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Cabin-level minNights takes priority over global setting
    const effectiveMinNights = cabin.minNights || settings.minBookingLength;

    if (
      numNights < effectiveMinNights ||
      numNights > settings.maxBookingLength
    ) {
      const response: ApiResponse<never> = {
        success: false,
        error: `Booking length must be between ${effectiveMinNights} and ${settings.maxBookingLength} nights`,
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Calculate prices
    const effectivePrice = cabin.price - cabin.discount;
    const cabinPrice = effectivePrice * numNights;

    let extrasPrice = 0;
    const bookingExtras = {
      hasBreakfast: extras.hasBreakfast,
      breakfastPrice: 0,
      hasPets: extras.hasPets,
      petFee: 0,
      hasParking: extras.hasParking,
      parkingFee: 0,
      hasEarlyCheckIn: extras.hasEarlyCheckIn,
      earlyCheckInFee: 0,
      hasLateCheckOut: extras.hasLateCheckOut,
      lateCheckOutFee: 0,
    };

    if (bookingExtras.hasBreakfast) {
      bookingExtras.breakfastPrice =
        settings.breakfastPrice * numGuests * numNights;
      extrasPrice += bookingExtras.breakfastPrice;
    }

    if (bookingExtras.hasPets && settings.allowPets) {
      bookingExtras.petFee = settings.petFee * numNights;
      extrasPrice += bookingExtras.petFee;
    }

    if (bookingExtras.hasParking && !settings.parkingIncluded) {
      bookingExtras.parkingFee = settings.parkingFee * numNights;
      extrasPrice += bookingExtras.parkingFee;
    }

    if (bookingExtras.hasEarlyCheckIn) {
      bookingExtras.earlyCheckInFee = settings.earlyCheckInFee;
      extrasPrice += bookingExtras.earlyCheckInFee;
    }

    if (bookingExtras.hasLateCheckOut) {
      bookingExtras.lateCheckOutFee = settings.lateCheckOutFee;
      extrasPrice += bookingExtras.lateCheckOutFee;
    }

    const totalPrice = cabinPrice + extrasPrice;
    const depositAmount = settings.requireDeposit
      ? Math.round(totalPrice * (settings.depositPercentage / 100))
      : 0;

    // Create booking
    const booking = await Booking.create({
      cabin: cabinId,
      customer: userId,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      numNights,
      numGuests,
      status: 'unconfirmed',
      cabinPrice: effectivePrice,
      extrasPrice,
      totalPrice,
      isPaid: false,
      paymentMethod: 'online',
      extras: bookingExtras,
      specialRequests,
      observations,
      depositPaid: false,
      depositAmount,
    });

    // Populate the booking for response
    const populatedBooking = (await Booking.findById(booking._id).populate(
      'cabin'
    )) as unknown as PopulatedBooking;
    const response: ApiResponse<any> = {
      success: true,
      data: populatedBooking,
      message: 'Booking created successfully',
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating booking:', error);

    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to create booking',
    };

    return NextResponse.json(response, { status: 500 });
  }
}
