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
import type { ApiResponse, PopulatedBooking } from '@/types';
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

    await connectDB();
    const { id } = await params;

    const booking = await Booking.findById(id).populate('cabin');

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

    const response: ApiResponse<any> = {
      success: true,
      data: booking,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error fetching booking:', error);

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

    await connectDB();
    const { id } = await params;
    const body = await request.json();

    // Validate request body with Zod
    const validation = validateRequest(updateBookingDetailsSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const updatedBooking = await updateCustomerBooking(
      id,
      userId,
      validation.data
    );

    const response: ApiResponse<any> = {
      success: true,
      data: updatedBooking,
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
    console.error('Error updating booking:', error);

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

    await connectDB();
    const { id } = await params;

    // Parse optional cancellation reason from body (only if JSON content-type)
    let cancellationReason: string | undefined;
    const contentType = request.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      try {
        const body = await request.json();
        cancellationReason = body.reason;
      } catch (parseError) {
        // Log malformed JSON but don't fail the cancellation
        console.error('Failed to parse cancellation request body:', parseError);
      }
    }
    // If no content-type or not JSON, cancellationReason remains undefined (expected for simple DELETE)

    // Find the booking with cabin populated for email
    const booking = await Booking.findById(id).populate(
      'cabin',
      'name image capacity price discount description'
    );

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
            refundAmount: booking.refundRequestedAmount ?? 0,
            refundType: 'partial' as const,
            reason: 'Previously requested cancellation refund',
          }
        : calculateRefund(booking, settings);

    if (booking.status !== 'cancelled') {
      // Persist the cancellation and its refund plan before contacting Stripe.
      // Concurrent cancellation/payment requests lose the version comparison.
      let remaining = refundEstimate.refundAmount;
      booking.cancellationRefunds = [];
      for (const payment of booking.payments) {
        if (!payment.paymentIntentId || remaining <= 0) continue;
        const amount =
          Math.round(
            Math.min(
              remaining,
              payment.amount - (payment.refundedAmount ?? 0)
            ) * 100
          ) / 100;
        if (amount <= 0) continue;
        booking.cancellationRefunds.push({
          paymentIntentId: payment.paymentIntentId,
          amount,
        });
        remaining = Math.round((remaining - amount) * 100) / 100;
      }
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
      const result = await createRefund(
        refund.paymentIntentId,
        refund.amount,
        `cancel:${id}:${refund.paymentIntentId}`
      );
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
    const updatedBooking = await Booking.findById(id).populate('cabin');
    const refundStatus = updatedBooking?.refundStatus ?? 'none';

    // Send cancellation confirmation email (async, don't block response)
    if (updatedBooking && updatedBooking.cabin) {
      const populatedBooking = updatedBooking as unknown as PopulatedBooking;
      sendCancellationConfirmationEmail({
        booking: populatedBooking,
        cabin: populatedBooking.cabin,
        refundAmount: refundEstimate.refundAmount,
        refundType: refundEstimate.refundType,
        reason: refundEstimate.reason,
      }).catch(err => {
        console.error('Failed to send cancellation email:', err);
      });
    } else {
      console.error(
        'Could not send cancellation email: booking or cabin data missing after update'
      );
    }

    const response: ApiResponse<any> = {
      success: true,
      data: {
        booking: updatedBooking,
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
    console.error('Error cancelling booking:', error);

    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to cancel booking',
    };

    return NextResponse.json(response, { status: 500 });
  }
}
