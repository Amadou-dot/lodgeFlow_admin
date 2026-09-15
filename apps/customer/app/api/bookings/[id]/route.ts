import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

import { Booking, Settings, connectDB } from '@/models';
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

    // Find the booking
    const booking = await Booking.findById(id);

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

    // Prevent modifications to checked-in/checked-out bookings
    if (booking.status === 'checked-in' || booking.status === 'checked-out') {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Cannot modify bookings that are checked-in or checked-out',
      };
      return NextResponse.json(response, { status: 400 });
    }

    const updates = validation.data;

    // Update the booking
    const updatedBooking = await Booking.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    }).populate('cabin');

    const response: ApiResponse<any> = {
      success: true,
      data: updatedBooking,
      message: 'Booking updated successfully',
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
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

    // Check if booking can be cancelled
    if (
      booking.status === 'checked-in' ||
      booking.status === 'checked-out' ||
      booking.status === 'cancelled'
    ) {
      const response: ApiResponse<never> = {
        success: false,
        error: `Cannot cancel booking with status: ${booking.status}`,
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Get settings for cancellation policy
    const settings = await Settings.getSettings();

    // Calculate refund based on policy
    let refundEstimate: {
      refundAmount: number;
      refundType: 'full' | 'partial' | 'none';
      reason: string;
    } = {
      refundAmount: 0,
      refundType: 'none',
      reason: 'No payment made',
    };

    if (booking.isPaid || booking.depositPaid) {
      const estimate = calculateRefund(booking, settings);
      refundEstimate = {
        refundAmount: estimate.refundAmount,
        refundType: estimate.refundType,
        reason: estimate.reason,
      };
    }

    // Process Stripe refund if applicable
    let refundStatus: 'none' | 'pending' | 'processing' | 'failed' = 'none';
    let stripeRefundError: string | undefined;

    if (refundEstimate.refundAmount > 0 && booking.stripePaymentIntentId) {
      refundStatus = 'processing';

      const refundResult = await createRefund(
        booking.stripePaymentIntentId,
        refundEstimate.refundAmount
      );

      if (!refundResult.success) {
        refundStatus = 'failed';
        stripeRefundError = refundResult.error;
        console.error('Stripe refund failed:', refundResult.error);
      } else {
        // Refund initiated - webhook will update status to 'partial' or 'full' when completed
        refundStatus = 'pending';
      }
    }

    // Update booking with cancellation details
    const updateData = {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancellationReason,
      refundStatus,
      refundAmount: refundEstimate.refundAmount,
    };

    const updatedBooking = await Booking.findByIdAndUpdate(id, updateData, {
      new: true,
    }).populate('cabin');

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
    console.error('Error cancelling booking:', error);

    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to cancel booking',
    };

    return NextResponse.json(response, { status: 500 });
  }
}
