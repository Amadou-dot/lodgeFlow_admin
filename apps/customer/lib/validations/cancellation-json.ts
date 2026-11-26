import { z } from 'zod';
import { timestamp } from '@lodgeflow/database/reservation-read-fields';
import type { RefundEstimateResponse } from '@/types/cancellation';
import { decodeSuccess } from './read-response';

const policy = z.enum(['flexible', 'moderate', 'strict']).nullable();
const refundEstimate = z
  .object({
    estimate: z.object({
      refundPercentage: z.int().min(0).max(100),
      refundAmount: z.number().nonnegative(),
      refundType: z.enum(['full', 'partial', 'none']),
      reason: z.string(),
      daysUntilCheckIn: z.int(),
      policy,
    }),
    deadlines: z.object({
      fullRefundDeadline: timestamp.nullable(),
      partialRefundDeadline: timestamp.nullable(),
      partialRefundPercentage: z.int().min(0).max(100),
      policy,
    }),
    policyDescription: z.string(),
    canCancel: z.boolean(),
    cancelNotAllowedReason: z.string().optional(),
  })
  .refine(
    row => row.canCancel || !!row.cancelNotAllowedReason
  ) satisfies z.ZodType<RefundEstimateResponse>;
export const decodeRefundEstimate = decodeSuccess(refundEstimate);
