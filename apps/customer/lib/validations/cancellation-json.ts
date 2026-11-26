import { majorAmount, MoneyError } from '@lodgeflow/database/money';
import { REFUND_STATUSES } from '@lodgeflow/database/config';
import { bookingDetail } from './booking-read-json';
import { ownedDetail, type MutationTarget } from './mutation-response';
import { z } from 'zod';
import { timestamp } from '@lodgeflow/database/reservation-read-fields';
import type { RefundEstimateResponse } from '@/types/cancellation';
import { decodeSuccess } from './read-response';

const policy = z.enum(['flexible', 'moderate', 'strict']).nullable();
const roundedAmount = z.number().refine(value => {
  try {
    majorAmount(value, { precision: 'exact' });
    return true;
  } catch (error) {
    if (!(error instanceof MoneyError)) throw error;
    return false;
  }
});
const terms = z.object({
  reason: z.string(),
  daysUntilCheckIn: z.int(),
  policy,
  refundAmount: roundedAmount,
});
const estimate = z.discriminatedUnion('refundType', [
  terms.extend({
    refundType: z.literal('none'),
    refundPercentage: z.literal(0),
    refundAmount: z.literal(0),
  }),
  terms.extend({
    refundType: z.literal('partial'),
    refundPercentage: z.literal(50),
  }),
  terms.extend({
    refundType: z.literal('full'),
    refundPercentage: z.literal(100),
  }),
]);
const refundEstimate = z
  .object({
    estimate,
    deadlines: z.object({
      fullRefundDeadline: timestamp.nullable(),
      partialRefundDeadline: timestamp.nullable(),
      partialRefundPercentage: z.literal([0, 50]),
      policy,
    }),
    policyDescription: z.string(),
    canCancel: z.boolean(),
    cancelNotAllowedReason: z.string().optional(),
  })
  .refine(row => row.estimate.policy === row.deadlines.policy, {
    path: ['deadlines', 'policy'],
  })
  .refine(
    row =>
      row.canCancel
        ? row.cancelNotAllowedReason === undefined
        : !!row.cancelNotAllowedReason?.trim(),
    { path: ['cancelNotAllowedReason'] }
  ) satisfies z.ZodType<RefundEstimateResponse>;
export const decodeRefundEstimate = decodeSuccess(refundEstimate);

export const cancellationResult = (target: MutationTarget) =>
  z
    .object({
      booking: ownedDetail(bookingDetail, target).nullable(),
      refund: z
        .object({
          amount: roundedAmount,
          type: z.enum(['none', 'partial', 'full']),
          status: z.enum(REFUND_STATUSES),
          reason: z.string(),
          error: z.string().optional(),
        })
        .refine(refund => refund.type !== 'none' || refund.amount === 0),
    })
    .refine(
      result =>
        result.refund.status === (result.booking?.refundStatus ?? 'none')
    );
