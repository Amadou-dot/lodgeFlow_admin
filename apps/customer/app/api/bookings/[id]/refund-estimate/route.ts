import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

import { Booking, Settings, connectDB } from '@/models';
import {
  calculateRefund,
  getCancellationDeadlines,
  formatCancellationPolicy,
} from '@/lib/cancellation';
import type { ApiResponse } from '@/types';
import type { RefundEstimate, CancellationDeadlines } from '@/lib/cancellation';

interface RefundEstimateResponse {
  estimate: RefundEstimate;
  deadlines: CancellationDeadlines;
  policyDescription: string;
  canCancel: boolean;
  cancelNotAllowedReason?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<RefundEstimateResponse>>> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;
    await connectDB();

    const booking = await Booking.findById(id);
    if (!booking) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (booking.customer !== userId) {
      return NextResponse.json(
        { success: false, error: 'Not authorized to view this booking' },
        { status: 403 }
      );
    }

    // Check if cancellation is allowed
    const nonCancellableStatuses = ['checked-in', 'checked-out', 'cancelled'];
    if (nonCancellableStatuses.includes(booking.status)) {
      return NextResponse.json({
        success: true,
        data: {
          estimate: {
            refundPercentage: 0,
            refundAmount: 0,
            refundType: 'none' as const,
            reason: `Booking cannot be cancelled - current status: ${booking.status}`,
            daysUntilCheckIn: 0,
            policy: 'moderate',
          },
          deadlines: {
            fullRefundDeadline: null,
            partialRefundDeadline: null,
            partialRefundPercentage: 0,
            policy: 'moderate',
          },
          policyDescription: '',
          canCancel: false,
          cancelNotAllowedReason: `Booking is already ${booking.status}`,
        },
      });
    }

    // Get settings for cancellation policy
    const settings = await Settings.findOne();
    if (!settings) {
      return NextResponse.json(
        { success: false, error: 'Settings not found' },
        { status: 500 }
      );
    }

    // Calculate refund estimate
    const estimate = calculateRefund(booking, settings);
    const deadlines = getCancellationDeadlines(
      booking.checkInDate,
      settings.cancellationPolicy
    );
    const policyDescription = formatCancellationPolicy(
      settings.cancellationPolicy
    );

    return NextResponse.json({
      success: true,
      data: {
        estimate,
        deadlines,
        policyDescription,
        canCancel: true,
      },
    });
  } catch (error) {
    console.error('Error calculating refund estimate:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to calculate refund estimate' },
      { status: 500 }
    );
  }
}
