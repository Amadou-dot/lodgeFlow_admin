import type { IBooking } from '@lodgeflow/database/models/Booking';
import type { ISettings } from '@lodgeflow/database/models/Settings';
import type { CancellationPolicy, RefundEstimate } from '@/types/cancellation';
export type { CancellationPolicy, RefundEstimate } from '@/types/cancellation';

export type RefundBooking = Pick<
  IBooking,
  'checkInDate' | 'amountPaid' | 'refundAmount'
>;
export type RefundSettings = Pick<ISettings, 'cancellationPolicy'>;

export interface CancellationDeadlines {
  fullRefundDeadline: Date | null;
  partialRefundDeadline: Date | null;
  partialRefundPercentage: number;
  policy: CancellationPolicy;
}

function getDaysUntilCheckIn(
  checkInDate: Date,
  cancellationDate: Date = new Date()
): number {
  const checkIn = new Date(checkInDate);
  const cancellation = new Date(cancellationDate);

  // Set to start of day for consistent comparison
  checkIn.setHours(0, 0, 0, 0);
  cancellation.setHours(0, 0, 0, 0);

  const diffTime = checkIn.getTime() - cancellation.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

export function calculateRefund(
  booking: RefundBooking,
  settings: RefundSettings,
  cancellationDate: Date = new Date()
): RefundEstimate {
  const policy = settings.cancellationPolicy;
  const daysUntilCheckIn = getDaysUntilCheckIn(
    booking.checkInDate,
    cancellationDate
  );

  // Refund only received money; a required but unpaid deposit is not refundable.
  const amountPaid = Math.max(
    0,
    (booking.amountPaid ?? 0) - (booking.refundAmount ?? 0)
  );

  if (amountPaid === 0) {
    return {
      refundPercentage: 0,
      refundAmount: 0,
      refundType: 'none',
      reason: 'No payment has been made for this booking',
      daysUntilCheckIn,
      policy,
    };
  }

  let refundPercentage = 0;
  let reason = '';

  switch (policy) {
    case 'flexible':
      // Full refund up to 24 hours before check-in
      if (daysUntilCheckIn >= 1) {
        refundPercentage = 100;
        reason = 'Full refund - cancelled more than 24 hours before check-in';
      } else {
        refundPercentage = 0;
        reason = 'No refund - cancelled less than 24 hours before check-in';
      }
      break;

    case 'moderate':
      // Full refund 5+ days before, 50% 2-5 days before, none <2 days
      if (daysUntilCheckIn >= 5) {
        refundPercentage = 100;
        reason = 'Full refund - cancelled 5 or more days before check-in';
      } else if (daysUntilCheckIn >= 2) {
        refundPercentage = 50;
        reason = '50% refund - cancelled 2-5 days before check-in';
      } else {
        refundPercentage = 0;
        reason = 'No refund - cancelled less than 2 days before check-in';
      }
      break;

    case 'strict':
      // 50% refund 7+ days before, none after
      if (daysUntilCheckIn >= 7) {
        refundPercentage = 50;
        reason = '50% refund - cancelled 7 or more days before check-in';
      } else {
        refundPercentage = 0;
        reason = 'No refund - cancelled less than 7 days before check-in';
      }
      break;

    default:
      refundPercentage = 0;
      reason = 'Unknown cancellation policy';
  }

  const refundAmount =
    Math.round(((amountPaid * refundPercentage) / 100) * 100) / 100;
  const refundType =
    refundPercentage === 100
      ? 'full'
      : refundPercentage > 0
        ? 'partial'
        : 'none';

  return {
    refundPercentage,
    refundAmount,
    refundType,
    reason,
    daysUntilCheckIn,
    policy,
  };
}

export function getCancellationDeadlines(
  checkInDate: Date,
  policy: CancellationPolicy
): CancellationDeadlines {
  const checkIn = new Date(checkInDate);
  checkIn.setHours(0, 0, 0, 0);

  let fullRefundDeadline: Date | null = null;
  let partialRefundDeadline: Date | null = null;
  let partialRefundPercentage = 0;

  switch (policy) {
    case 'flexible':
      // Full refund deadline: 1 day before check-in
      fullRefundDeadline = new Date(checkIn);
      fullRefundDeadline.setDate(fullRefundDeadline.getDate() - 1);
      break;

    case 'moderate':
      // Full refund deadline: 5 days before check-in
      fullRefundDeadline = new Date(checkIn);
      fullRefundDeadline.setDate(fullRefundDeadline.getDate() - 5);
      // Partial refund deadline: 2 days before check-in (50%)
      partialRefundDeadline = new Date(checkIn);
      partialRefundDeadline.setDate(partialRefundDeadline.getDate() - 2);
      partialRefundPercentage = 50;
      break;

    case 'strict':
      // No full refund
      // Partial refund deadline: 7 days before check-in (50%)
      partialRefundDeadline = new Date(checkIn);
      partialRefundDeadline.setDate(partialRefundDeadline.getDate() - 7);
      partialRefundPercentage = 50;
      break;
  }

  return {
    fullRefundDeadline,
    partialRefundDeadline,
    partialRefundPercentage,
    policy,
  };
}

export function formatCancellationPolicy(policy: CancellationPolicy): string {
  switch (policy) {
    case 'flexible':
      return 'Full refund up to 24 hours before check-in';
    case 'moderate':
      return 'Full refund 5+ days before check-in, 50% refund 2-5 days before, no refund within 2 days';
    case 'strict':
      return '50% refund 7+ days before check-in, no refund within 7 days';
    default:
      return 'Unknown policy';
  }
}
