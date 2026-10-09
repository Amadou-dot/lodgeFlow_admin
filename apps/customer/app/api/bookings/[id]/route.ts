import { readJsonRequestBody } from '@/lib/validations/request-body';
import {
  bookingIdSchema,
  cancelBookingSchema,
} from '@/lib/validations/booking';
import { logger } from '@lodgeflow/database/logger';
import {
  majorAmount,
  roundMajorAmount,
  type MajorCurrencyAmount,
} from '@lodgeflow/database/money';
import {
  serializeBookingDetail,
  type DetailCabinSource,
} from '@/lib/serializers/booking-read';
import type { BookingDetail } from '@/types/booking-read';
import mongoose from 'mongoose';
import {
  updateCustomerBooking,
  BookingRuleError,
  BookingPaymentError,
  BookingPricingError,
} from '@lodgeflow/database';
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

import { Booking, Settings, connectDB } from '@lodgeflow/database';
import { calculateRefund } from '@/lib/cancellation';
import { createRefund } from '@/lib/stripe';
import { sendCancellationConfirmationEmail } from '@/lib/email';
import type { ApiResponse, CancellationResponse } from '@/types';
import { updateBookingDetailsSchema } from '@/lib/validations';
import {
  validateRequest,
  validationErrorResponse,
} from '@/lib/validations/utils';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Unauthorized',
      };
      return NextResponse.json(response, { status: 401 });
    }

    const { id } = await params;
    if (!bookingIdSchema.safeParse(id).success)
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      );

    await connectDB();
    const booking = await Booking.findById(id).populate<{
      cabin: DetailCabinSource | null;
    }>('cabin');

    if (!booking) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Booking not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    if (booking.customer.toString() !== userId) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Booking not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    const response: ApiResponse<BookingDetail> = {
      success: true,
      data: serializeBookingDetail(booking),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    logger.error('Error fetching booking:', error);

    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to fetch booking',
    };

    return NextResponse.json(response, { status: 500 });
  }
}

/**
 * PATCH /api/bookings/[id]
 * Update booking details (limited to customer's own bookings)
 * Customers can only update: numGuests, specialRequests, extras
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Unauthorized',
      };
      return NextResponse.json(response, { status: 401 });
    }

    const { id } = await params;
    if (!bookingIdSchema.safeParse(id).success)
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      );
    const json = await readJsonRequestBody(request);
    if (!json.success) return validationErrorResponse(json.error);
    const validation = validateRequest(updateBookingDetailsSchema, json.data);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    await connectDB();
    const updatedBooking = await updateCustomerBooking({
      bookingId: id,
      customerId: userId,
      updates: validation.data,
    });

    const response: ApiResponse<BookingDetail> = {
      success: true,
      data: serializeBookingDetail(updatedBooking),
      message: 'Booking updated successfully',
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    if (
      error instanceof BookingRuleError ||
      error instanceof BookingPaymentError ||
      error instanceof BookingPricingError ||
      error instanceof mongoose.Error.VersionError
    ) {
      const status =
        error instanceof BookingRuleError
          ? error.status
          : error instanceof BookingPricingError
            ? 400
            : 409;
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof mongoose.Error.VersionError
              ? 'Booking changed; refresh and try again'
              : error.message,
        },
        { status }
      );
    }
    logger.error('Error updating booking:', error);

    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to update booking',
    };

    return NextResponse.json(response, { status: 500 });
  }
}

/**
 * DELETE /api/bookings/[id]
 * Cancel a booking (soft delete - changes status to 'cancelled')
 * Processes refunds based on cancellation policy and sends confirmation email
 * Cannot cancel bookings with status: checked-in, checked-out, or cancelled
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Unauthorized',
      };
      return NextResponse.json(response, { status: 401 });
    }

    const { id } = await params;
    if (!bookingIdSchema.safeParse(id).success)
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      );

    // Empty/non-JSON DELETE bodies retain the optional-reason contract.
    let cancellationReason: string | undefined;
    if (request.headers.get('content-type')?.includes('application/json')) {
      const text = await request.text();
      if (text.trim()) {
        const json = await readJsonRequestBody({ text: async () => text });
        if (!json.success) return validationErrorResponse(json.error);
        const validation = validateRequest(cancelBookingSchema, json.data);
        if (!validation.success)
          return validationErrorResponse(validation.error);
        cancellationReason = validation.data.reason;
      }
    }

    // Find the booking with cabin populated for email
    await connectDB();
    const booking = await Booking.findById(id).populate<{
      cabin: Pick<DetailCabinSource, 'name'> | null;
    }>('cabin', 'name image capacity price discount description');

    if (!booking) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Booking not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    // Verify the booking belongs to the authenticated user
    if (booking.customer.toString() !== userId) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Booking not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    if (booking.checkoutPending) {
      return NextResponse.json(
        {
          success: false,
          error: 'Checkout is active; complete or expire it before cancelling',
        },
        { status: 409 }
      );
    }
    if (['checked-in', 'checked-out'].includes(booking.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot cancel booking with status: ${booking.status}`,
        },
        { status: 400 }
      );
    }
    const settings = await Settings.getSettings();
    const refundEstimate =
      booking.status === 'cancelled'
        ? {
            refundAmount: majorAmount(booking.refundRequestedAmount ?? 0, {
              precision: 'exact',
            }),
            refundType: 'partial' as const,
            reason: 'Previously requested cancellation refund',
          }
        : calculateRefund(booking, settings);

    if (booking.status !== 'cancelled') {
      // Persist the cancellation and its refund plan before contacting Stripe.
      // Concurrent cancellation/payment requests lose the version comparison.
      let remaining = refundEstimate.refundAmount;
      const cancellationRefunds: {
        paymentIntentId: string;
        amount: MajorCurrencyAmount;
      }[] = [];
      for (const payment of booking.payments) {
        if (!payment.paymentIntentId || remaining <= 0) continue;
        const received = majorAmount(payment.amount, {
          precision: 'exact',
          sign: 'positive',
        });
        const refunded = majorAmount(payment.refundedAmount ?? 0, {
          precision: 'exact',
        });
        const amount = roundMajorAmount({
          amount: majorAmount(Math.min(remaining, received - refunded), {
            precision: 'preserve',
            sign: 'signed',
          }),
          rounding: 'nearest',
        });
        if (amount <= 0) continue;
        cancellationRefunds.push({
          paymentIntentId: payment.paymentIntentId,
          amount,
        });
        remaining = roundMajorAmount({
          amount: majorAmount(remaining - amount, {
            precision: 'preserve',
            sign: 'signed',
          }),
          rounding: 'nearest',
        });
      }
      booking.cancellationRefunds = cancellationRefunds;
      booking.status = 'cancelled';
      booking.cancelledAt = new Date();
      booking.cancellationReason = cancellationReason;
      booking.refundRequestedAmount = refundEstimate.refundAmount;
      booking.refundStatus =
        refundEstimate.refundAmount > 0 ? 'pending' : 'none';
      await booking.save();
    }

    let stripeRefundError: string | undefined;
    for (const refund of booking.cancellationRefunds) {
      if (refund.refundId) continue;
      // Stripe retains idempotency keys for at least 24 hours. An unresolved older
      // request needs reconciliation instead of risking a second refund.
      if (Date.now() - booking.cancelledAt!.getTime() > 23 * 60 * 60 * 1000) {
        stripeRefundError = 'Refund requires staff reconciliation';
        break;
      }
      const result = await createRefund({
        paymentIntentId: refund.paymentIntentId,
        amount: majorAmount(refund.amount, {
          precision: 'exact',
          sign: 'positive',
        }),
        idempotencyKey: `cancel:${id}:${refund.paymentIntentId}`,
      });
      if (!result.success) {
        stripeRefundError = result.error;
        break;
      }
      await Booking.updateOne(
        {
          _id: id,
          'cancellationRefunds.paymentIntentId': refund.paymentIntentId,
        },
        {
          $set: { 'cancellationRefunds.$.refundId': result.refundId },
          $inc: { __v: 1 },
        }
      );
    }
    // refundAmount records completed refunds only; signed webhooks update it.
    // Offline receipts remain pending for staff to return and record manually.
    const updatedBooking = await Booking.findById(id).populate<{
      cabin: DetailCabinSource | null;
    }>('cabin');
    const refundStatus = updatedBooking?.refundStatus ?? 'none';

    // Send cancellation confirmation email (async, don't block response)
    if (updatedBooking && updatedBooking.cabin) {
      sendCancellationConfirmationEmail({
        booking: updatedBooking,
        cabin: updatedBooking.cabin,
        refundAmount: refundEstimate.refundAmount,
        refundType: refundEstimate.refundType,
        reason: refundEstimate.reason,
      }).catch(err => {
        logger.error('Failed to send cancellation email:', err);
      });
    } else {
      logger.error(
        'Could not send cancellation email: booking or cabin data missing after update'
      );
    }

    const response: ApiResponse<CancellationResponse> = {
      success: true,
      data: {
        booking: updatedBooking ? serializeBookingDetail(updatedBooking) : null,
        refund: {
          amount: refundEstimate.refundAmount,
          type: refundEstimate.refundType,
          status: refundStatus,
          reason: refundEstimate.reason,
          error: stripeRefundError,
        },
      },
      message: 'Booking cancelled successfully',
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    if (error instanceof mongoose.Error.VersionError)
      return NextResponse.json(
        { success: false, error: 'Booking changed; refresh and try again' },
        { status: 409 }
      );
    logger.error('Error cancelling booking:', error);

    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to cancel booking',
    };

    return NextResponse.json(response, { status: 500 });
  }
}
