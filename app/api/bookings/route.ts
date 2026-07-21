import {
  createValidationErrorResponse,
  escapeRegex,
  parsePagination,
  requireApiAuth,
} from '@/lib/api-utils';
import mongoose from 'mongoose';
import {
  BookingPricingError,
  calculateBookingPricing,
} from '@/lib/booking-pricing';
import { getClerkUsersBatch, searchClerkUsers } from '@/lib/clerk-users';
import { VALID_TRANSITIONS } from '@/lib/config';
import { logger } from '@/lib/logger';
import connectDB from '@/lib/mongodb';
import { createBookingSchema, updateBookingSchema } from '@/lib/validations';
import type { IBooking } from '@/models/Booking';
import type { BookingQueryFilter, MongoSortOrder } from '@/types/api';
import { getErrorMessage, isMongooseValidationError } from '@/types/errors';
import { NextRequest, NextResponse } from 'next/server';
import { Booking, Cabin, Settings } from '../../../models';

async function populateBookingsWithClerkCustomers(bookings: IBooking[]) {
  const customerIds = bookings.map(booking => booking.customer);
  const uniqueCustomerIds = Array.from(new Set(customerIds)) as string[];

  // Batch fetch all customers with optimized caching
  const { users: customerMap, errors: clerkErrors } =
    await getClerkUsersBatch(uniqueCustomerIds);

  // Populate bookings with customer data
  const populatedBookings = bookings.map(booking => {
    const customer = customerMap.get(booking.customer);

    // Provide fallback for missing customers
    const customerData = customer || {
      id: booking.customer,
      name: 'Unknown User',
      email: 'N/A',
    };

    return {
      ...booking.toObject(),
      customer: customerData,
      guest: customerData, // For legacy compatibility
      cabinName: (booking.cabin as unknown as { name?: string })?.name,
    };
  });

  return {
    bookings: populatedBookings,
    _clerkWarning:
      clerkErrors > 0
        ? `Failed to fetch ${clerkErrors} customer record(s) from Clerk. Some customer data may be unavailable.`
        : undefined,
  };
}

export async function GET(request: NextRequest) {
  // Require authentication
  const authResult = await requireApiAuth();
  if (!authResult.authenticated) return authResult.error;

  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'checkInDate';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build query for status filter only
    const query: BookingQueryFilter = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    // Build sort object (whitelist sortable fields — sortBy is user input)
    const SORTABLE_FIELDS = new Set([
      'checkInDate',
      'checkOutDate',
      'totalPrice',
      'createdAt',
      'status',
      'numNights',
      'numGuests',
    ]);
    const sortField = sortBy === 'created_at' ? 'createdAt' : sortBy;
    const sort: MongoSortOrder = {};
    sort[SORTABLE_FIELDS.has(sortField) ? sortField : 'checkInDate'] =
      sortOrder === 'desc' ? -1 : 1;

    // If there's a search term, resolve matching cabins and customers first,
    // then run a fully database-side paginated query. This keeps the search
    // bounded — the previous approach loaded every booking into memory and
    // fetched every customer from Clerk before paginating.
    if (search) {
      const safeSearch = escapeRegex(search);

      // Phase 1a: Find matching cabin IDs from database
      const matchingCabins = await Cabin.find({
        name: { $regex: safeSearch, $options: 'i' },
      }).select('_id');
      const cabinIds = matchingCabins.map(c => c._id);

      // Phase 1b: Find matching customer IDs via Clerk search (name/email).
      // Bounded to the first 100 matches to keep the query cheap.
      let customerIds: string[] = [];
      try {
        const { data: matchingCustomers } = await searchClerkUsers(search, 100);
        customerIds = matchingCustomers.map(c => c.id);
      } catch (clerkError) {
        logger.error('Clerk customer search failed', clerkError);
      }

      if (cabinIds.length === 0 && customerIds.length === 0) {
        return NextResponse.json({
          success: true,
          data: [],
          pagination: {
            currentPage: page,
            totalPages: 0,
            totalBookings: 0,
            limit,
            hasNextPage: false,
            hasPrevPage: false,
          },
        });
      }

      // Phase 2: Query bookings matching either, with DB-side pagination
      const searchQuery: BookingQueryFilter = { ...query };
      searchQuery.$or = [
        ...(cabinIds.length > 0 ? [{ cabin: { $in: cabinIds } }] : []),
        ...(customerIds.length > 0 ? [{ customer: { $in: customerIds } }] : []),
      ];

      const [matchingBookings, totalBookings] = await Promise.all([
        Booking.find(searchQuery)
          .populate('cabin', 'name image capacity price discount')
          .sort(sort)
          .skip(skip)
          .limit(limit),
        Booking.countDocuments(searchQuery),
      ]);

      // Populate with Clerk customer data (current page only)
      const { bookings: populatedBookings, _clerkWarning } =
        await populateBookingsWithClerkCustomers(matchingBookings);

      const totalPages = Math.ceil(totalBookings / limit);

      return NextResponse.json({
        success: true,
        data: populatedBookings,
        pagination: {
          currentPage: page,
          totalPages,
          totalBookings,
          limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
        ...(_clerkWarning ? { _clerkWarning } : {}),
      });
    } else {
      // No search term - use database pagination for better performance
      const bookings = await Booking.find(query)
        .populate('cabin', 'name image capacity price discount')
        .sort(sort)
        .skip(skip)
        .limit(limit);

      // Populate with Clerk customer data
      const { bookings: populatedBookings, _clerkWarning } =
        await populateBookingsWithClerkCustomers(bookings);

      const totalBookings = await Booking.countDocuments(query);
      const totalPages = Math.ceil(totalBookings / limit);

      return NextResponse.json({
        success: true,
        data: populatedBookings,
        pagination: {
          currentPage: page,
          totalPages,
          totalBookings,
          limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
        ...(_clerkWarning ? { _clerkWarning } : {}),
      });
    }
  } catch (error) {
    logger.error('Failed to fetch bookings', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch bookings',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Require authentication
  const authResult = await requireApiAuth();
  if (!authResult.authenticated) return authResult.error;

  try {
    await connectDB();

    const body = await request.json();

    // Validate request body
    const validationResult = createBookingSchema.safeParse(body);
    if (!validationResult.success) {
      return createValidationErrorResponse(validationResult.error);
    }

    // Verify cabin is active before creating booking
    const cabin = await Cabin.findById(validationResult.data.cabin);
    if (!cabin) {
      return NextResponse.json(
        { success: false, error: 'Cabin not found' },
        { status: 404 }
      );
    }
    if (cabin.status && cabin.status !== 'active') {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot create booking: cabin is currently ${cabin.status}`,
        },
        { status: 400 }
      );
    }

    // Validate against dynamic settings
    const settings = await Settings.getSettings();
    const { checkInDate, checkOutDate, numGuests, extras } =
      validationResult.data;

    // Recompute every price-derived field from the trusted cabin/settings
    // documents rather than trusting the client-supplied numNights,
    // cabinPrice, extrasPrice, and totalPrice (see issue #109).
    const pricing = calculateBookingPricing({
      cabin,
      settings,
      checkInDate,
      checkOutDate,
      numGuests,
      extras,
    });
    const { numNights } = pricing;
    const effectiveMinNights = Math.max(
      settings.minBookingLength,
      cabin.minNights ?? 0
    );
    const maxGuests = Math.min(settings.maxGuestsPerBooking, cabin.capacity);

    if (numNights < effectiveMinNights) {
      return NextResponse.json(
        {
          success: false,
          error: `Booking must be at least ${effectiveMinNights} night(s)`,
        },
        { status: 400 }
      );
    }
    if (numNights > settings.maxBookingLength) {
      return NextResponse.json(
        {
          success: false,
          error: `Booking cannot exceed ${settings.maxBookingLength} nights`,
        },
        { status: 400 }
      );
    }
    if (numGuests > maxGuests) {
      return NextResponse.json(
        {
          success: false,
          error: `Number of guests cannot exceed ${maxGuests}`,
        },
        { status: 400 }
      );
    }
    if (extras?.hasPets && !settings.allowPets) {
      return NextResponse.json(
        { success: false, error: 'Pets are not allowed' },
        { status: 400 }
      );
    }

    // Prevent double-bookings: reject if the cabin is already booked
    // for an overlapping date range
    const overlapping = await Booking.findOverlapping(
      validationResult.data.cabin,
      checkInDate,
      checkOutDate
    );
    if (overlapping.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            'The selected dates overlap with an existing booking for this cabin',
        },
        { status: 409 }
      );
    }

    const booking = await Booking.create({
      ...validationResult.data,
      numNights: pricing.numNights,
      cabinPrice: pricing.cabinPrice,
      extrasPrice: pricing.extrasPrice,
      totalPrice: pricing.totalPrice,
      extras: pricing.extras,
    });

    // Populate the response
    const populatedBooking = await Booking.findById(booking._id).populate(
      'cabin',
      'name image capacity price discount'
    );
    if (!populatedBooking) {
      return NextResponse.json(
        { success: false, error: 'Failed to load created booking' },
        { status: 500 }
      );
    }

    // Populate with Clerk customer data
    const {
      bookings: [populatedWithClerk],
      _clerkWarning,
    } = await populateBookingsWithClerkCustomers([populatedBooking]);

    return NextResponse.json(
      {
        success: true,
        data: populatedWithClerk,
        ...(_clerkWarning ? { _clerkWarning } : {}),
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    // A same-calendar-day booking can pass the Zod refine (which only
    // compares raw timestamps) but yield zero nights once
    // calculateBookingPricing measures calendar days — surface that as a
    // 400, not a generic server error.
    if (error instanceof BookingPricingError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    // Handle validation errors
    if (isMongooseValidationError(error)) {
      logger.warn(
        'Mongoose validation fired after Zod passed — possible schema drift',
        {
          validationErrors: Object.keys(error.errors),
        }
      );
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    // Handle date overlap errors
    const errorMessage = getErrorMessage(error);
    if (errorMessage.includes('overlap')) {
      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
        },
        { status: 409 } // Conflict
      );
    }

    logger.error('Failed to create booking', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create booking',
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  // Require authentication
  const authResult = await requireApiAuth();
  if (!authResult.authenticated) return authResult.error;

  try {
    await connectDB();

    const body = await request.json();

    // Validate request body
    const validationResult = updateBookingSchema.safeParse(body);
    if (!validationResult.success) {
      return createValidationErrorResponse(validationResult.error);
    }

    const { _id, ...updateData } = validationResult.data;

    // Never trust client-supplied pricing fields on update — same trust
    // boundary as POST (see calculateBookingPricing in lib/booking-pricing.ts
    // and issue #122). These are only ever set below, recomputed from the
    // cabin/settings documents when a pricing-relevant field actually changes.
    delete updateData.numNights;
    delete updateData.cabinPrice;
    delete updateData.extrasPrice;
    delete updateData.totalPrice;
    delete updateData.remainingAmount;

    // Fetch the existing booking first so auto-timestamping can check prior state
    const existingBooking = await Booking.findById(_id);
    if (!existingBooking) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Validate status transitions
    if (updateData.status && updateData.status !== existingBooking.status) {
      const allowed = VALID_TRANSITIONS[existingBooking.status] ?? [];
      if (!allowed.includes(updateData.status)) {
        return NextResponse.json(
          {
            success: false,
            error: `Cannot transition from '${existingBooking.status}' to '${updateData.status}'`,
          },
          { status: 400 }
        );
      }
    }

    // Auto-timestamp with guards to prevent overwriting existing values
    if (updateData.status === 'cancelled') {
      if (updateData.cancelledAt) {
        // Honor explicit value from client
      } else if (!existingBooking.cancelledAt) {
        updateData.cancelledAt = new Date();
      }
      updateData.refundStatus = updateData.refundStatus ?? 'none';
    }

    if (
      updateData.isPaid &&
      !existingBooking.paidAt &&
      !existingBooking.isPaid
    ) {
      updateData.paidAt = updateData.paidAt ?? new Date();
    }

    if (
      (updateData.refundStatus === 'partial' ||
        updateData.refundStatus === 'full') &&
      updateData.refundAmount !== undefined &&
      !existingBooking.refundedAt
    ) {
      updateData.refundedAt = updateData.refundedAt ?? new Date();
    }

    // Reject cancellation/refund fields on non-cancelled bookings
    if (
      updateData.status !== 'cancelled' &&
      existingBooking.status !== 'cancelled'
    ) {
      const cancellationFields = [
        'refundStatus',
        'refundAmount',
        'refundedAt',
        'cancellationReason',
        'cancelledAt',
      ].filter(f => (updateData as Record<string, unknown>)[f] !== undefined);
      if (cancellationFields.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Cannot set ${cancellationFields.join(', ')} on a booking with status '${existingBooking.status}'. The booking must be cancelled first.`,
          },
          { status: 400 }
        );
      }
    }

    // Validate refundAmount does not exceed totalPrice
    if (
      updateData.refundAmount !== undefined &&
      updateData.refundAmount > existingBooking.totalPrice
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `Refund amount (${updateData.refundAmount}) cannot exceed total price (${existingBooking.totalPrice})`,
        },
        { status: 400 }
      );
    }

    // Validate refundAmount requires a compatible refundStatus
    if (updateData.refundAmount !== undefined && updateData.refundAmount > 0) {
      const effectiveRefundStatus =
        updateData.refundStatus ?? existingBooking.refundStatus ?? 'none';
      if (effectiveRefundStatus === 'none') {
        return NextResponse.json(
          {
            success: false,
            error:
              'refundStatus must be "partial" or "full" when setting a non-zero refundAmount',
          },
          { status: 400 }
        );
      }
    }

    // Validate booking rules only when booking-rule inputs are changed.
    const shouldValidateBookingRules =
      updateData.cabin !== undefined ||
      updateData.checkInDate !== undefined ||
      updateData.checkOutDate !== undefined ||
      updateData.numGuests !== undefined ||
      updateData.extras !== undefined;

    if (shouldValidateBookingRules) {
      const settings = await Settings.getSettings();
      const checkIn = updateData.checkInDate || existingBooking.checkInDate;
      const checkOut = updateData.checkOutDate || existingBooking.checkOutDate;
      const numGuests = updateData.numGuests ?? existingBooking.numGuests;
      const extras = updateData.extras ?? existingBooking.extras;

      // Fetch cabin for minNights check
      const cabinId = updateData.cabin || existingBooking.cabin;
      const cabinForValidation = await Cabin.findById(cabinId);
      if (!cabinForValidation) {
        return NextResponse.json(
          { success: false, error: 'Cabin not found' },
          { status: 404 }
        );
      }

      // Recompute every price-derived field from the trusted cabin/settings
      // documents rather than trusting client-supplied cabinPrice, extrasPrice,
      // totalPrice, and extras.*Fee values (see issue #122 — same trust
      // boundary as POST).
      const pricing = calculateBookingPricing({
        cabin: cabinForValidation,
        settings,
        checkInDate: new Date(checkIn),
        checkOutDate: new Date(checkOut),
        numGuests,
        extras,
      });

      const effectiveMinNights = Math.max(
        settings.minBookingLength,
        cabinForValidation.minNights ?? 0
      );
      const maxGuests = Math.min(
        settings.maxGuestsPerBooking,
        cabinForValidation.capacity
      );

      if (pricing.numNights < effectiveMinNights) {
        return NextResponse.json(
          {
            success: false,
            error: `Booking must be at least ${effectiveMinNights} night(s)`,
          },
          { status: 400 }
        );
      }
      if (pricing.numNights > settings.maxBookingLength) {
        return NextResponse.json(
          {
            success: false,
            error: `Booking cannot exceed ${settings.maxBookingLength} nights`,
          },
          { status: 400 }
        );
      }
      if (numGuests > maxGuests) {
        return NextResponse.json(
          {
            success: false,
            error: `Number of guests cannot exceed ${maxGuests}`,
          },
          { status: 400 }
        );
      }
      if (pricing.extras.hasPets && !settings.allowPets) {
        return NextResponse.json(
          { success: false, error: 'Pets are not allowed' },
          { status: 400 }
        );
      }

      updateData.numNights = pricing.numNights;
      updateData.cabinPrice = pricing.cabinPrice;
      updateData.extrasPrice = pricing.extrasPrice;
      updateData.totalPrice = pricing.totalPrice;
      updateData.extras = pricing.extras;
    }

    // Only check for date overlaps when dates or cabin actually changed
    const cabinChanged =
      updateData.cabin &&
      updateData.cabin.toString() !== existingBooking.cabin.toString();
    const checkInChanged =
      updateData.checkInDate &&
      new Date(updateData.checkInDate).getTime() !==
        existingBooking.checkInDate.getTime();
    const checkOutChanged =
      updateData.checkOutDate &&
      new Date(updateData.checkOutDate).getTime() !==
        existingBooking.checkOutDate.getTime();

    if (cabinChanged || checkInChanged || checkOutChanged) {
      const cabinId = updateData.cabin || existingBooking.cabin;
      const checkIn = updateData.checkInDate || existingBooking.checkInDate;
      const checkOut = updateData.checkOutDate || existingBooking.checkOutDate;

      const overlapping = await Booking.findOverlapping(
        cabinId,
        checkIn,
        checkOut,
        new mongoose.Types.ObjectId(_id)
      );

      if (overlapping.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              'The selected dates overlap with an existing booking for this cabin',
          },
          { status: 409 }
        );
      }
    }

    // numNights/cabinPrice/extrasPrice/totalPrice are already recomputed above
    // (in the shouldValidateBookingRules block) whenever dates, cabin,
    // numGuests, or extras change — findByIdAndUpdate bypasses the Mongoose
    // pre-save hook that would otherwise handle this.

    if (
      updateData.totalPrice !== undefined ||
      updateData.depositAmount !== undefined
    ) {
      const effectiveTotalPrice =
        updateData.totalPrice ?? existingBooking.totalPrice;
      const effectiveDepositAmount =
        updateData.depositAmount ?? existingBooking.depositAmount;
      updateData.remainingAmount = Math.max(
        0,
        effectiveTotalPrice - effectiveDepositAmount
      );
    }

    const booking = await Booking.findByIdAndUpdate(_id, updateData, {
      new: true,
    }).populate('cabin', 'name image capacity price discount');

    if (!booking) {
      return NextResponse.json(
        {
          success: false,
          error: 'Booking not found',
        },
        { status: 404 }
      );
    }

    // Populate with Clerk customer data
    const {
      bookings: [populatedWithClerk],
      _clerkWarning,
    } = await populateBookingsWithClerkCustomers([booking]);

    return NextResponse.json({
      success: true,
      data: populatedWithClerk,
      ...(_clerkWarning ? { _clerkWarning } : {}),
    });
  } catch (error: unknown) {
    // A same-calendar-day date change can pass the Zod refine (which only
    // compares raw timestamps) but yield zero nights once
    // calculateBookingPricing measures calendar days — surface that as a
    // 400, not a generic server error.
    if (error instanceof BookingPricingError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    if (isMongooseValidationError(error)) {
      logger.warn(
        'Mongoose validation fired after Zod passed — possible schema drift (PUT)',
        {
          validationErrors: Object.keys(error.errors),
        }
      );
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    const errorMessage = getErrorMessage(error);
    if (errorMessage.includes('overlap')) {
      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
        },
        { status: 409 }
      );
    }

    logger.error('Failed to update booking', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update booking',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  // Require authentication
  const authResult = await requireApiAuth();
  if (!authResult.authenticated) return authResult.error;

  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Booking ID is required',
        },
        { status: 400 }
      );
    }

    // Get the booking before deleting to access customer ID
    const booking = await Booking.findById(id);

    if (!booking) {
      return NextResponse.json(
        {
          success: false,
          error: 'Booking not found',
        },
        { status: 404 }
      );
    }

    // Delete the booking
    await Booking.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      message: 'Booking deleted successfully',
    });
  } catch (error) {
    logger.error('Failed to delete booking', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete booking',
      },
      { status: 500 }
    );
  }
}
