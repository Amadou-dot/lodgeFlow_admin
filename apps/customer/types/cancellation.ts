import type { REFUND_STATUSES } from '@lodgeflow/database/config';
import type { BookingDetail } from './booking-read';

export type CancellationPolicy = 'flexible' | 'moderate' | 'strict';
export type RefundStatus = (typeof REFUND_STATUSES)[number];
export type RefundType = 'full' | 'partial' | 'none';

export interface RefundEstimate {
  refundPercentage: number;
  refundAmount: number;
  refundType: RefundType;
  reason: string;
  daysUntilCheckIn: number;
  policy: CancellationPolicy;
}

/** Dates cross the HTTP boundary as ISO strings, never Date objects. */
export interface CancellationDeadlines {
  fullRefundDeadline: string | null;
  partialRefundDeadline: string | null;
  partialRefundPercentage: number;
  policy: CancellationPolicy;
}

export interface RefundEstimateResponse {
  estimate: RefundEstimate;
  deadlines: CancellationDeadlines;
  policyDescription: string;
  canCancel: boolean;
  cancelNotAllowedReason?: string;
}

export interface CancellationResponse {
  booking: BookingDetail | null;
  refund: {
    amount: number;
    type: RefundType;
    status: RefundStatus;
    reason: string;
    error?: string;
  };
}
