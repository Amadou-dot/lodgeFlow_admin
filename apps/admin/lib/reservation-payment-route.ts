import Stripe from 'stripe';
import { z } from 'zod';
import {
  recordReservationReceipt,
  refundReservationStripe,
  ReservationRuleError,
} from '@lodgeflow/database';
import {
  createErrorResponse,
  createSuccessResponse,
  requireApiAuth,
} from './api-utils';
import { recordAudit } from './audit';
import connectDB from './mongodb';

const receiptSchema = z
  .object({
    id: z.uuid(),
    type: z.enum(['payment', 'refund']),
    amountCents: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    method: z.enum(['cash', 'bank_transfer', 'card', 'stripe']),
    reference: z.string().trim().max(200),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.method === 'stripe' && value.type !== 'refund')
      context.addIssue({
        code: 'custom',
        message: 'Use customer checkout to collect online payments',
      });
    if (
      (value.method !== 'cash' || value.type === 'refund') &&
      !value.reference
    )
      context.addIssue({
        code: 'custom',
        path: ['reference'],
        message: 'Provide a receipt reference or refund reason',
      });
  });
export async function reservationPayment(
  request: Request,
  { id, kind }: { id: string; kind: 'dining' | 'experience' }
) {
  const access = await requireApiAuth({ permission: 'bookings:manage' });
  if (!access.authenticated) return access.error;
  let body;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse('Invalid JSON', 400);
  }
  const parsed = receiptSchema.safeParse(body);
  if (!parsed.success)
    return createErrorResponse(parsed.error.issues[0].message, 400);
  if (parsed.data.type === 'refund') {
    const refundAccess = await requireApiAuth({ permission: 'refunds:issue' });
    if (!refundAccess.authenticated) return refundAccess.error;
  }
  try {
    await connectDB();
    if (parsed.data.method === 'stripe') {
      const result = await refundReservationStripe({
        kind,
        id,
        token: parsed.data.id,
        amountCents: parsed.data.amountCents,
        actor: access.userId!,
        reference: parsed.data.reference,
        stripe: new Stripe(process.env.STRIPE_SECRET_KEY!),
      });
      await recordAudit(access, {
        action: 'refund.record',
        resourceType:
          kind === 'dining' ? 'dining_reservation' : 'experience_booking',
        resourceId: id,
        before: {},
        after: { request: parsed.data, status: result.status },
      });
      return createSuccessResponse(result);
    }
    const result = await recordReservationReceipt({
      kind,
      id,
      receipt: { ...parsed.data, actor: access.userId! },
    });
    if (result.changed)
      await recordAudit(access, {
        action:
          parsed.data.type === 'payment' ? 'payment.record' : 'refund.record',
        resourceType:
          kind === 'dining' ? 'dining_reservation' : 'experience_booking',
        resourceId: id,
        before: {},
        after: { receipt: parsed.data },
      });
    return createSuccessResponse(result.reservation);
  } catch (error) {
    if (error instanceof ReservationRuleError)
      return createErrorResponse(error.message, error.status);
    return createErrorResponse('Unable to record transaction', 500);
  }
}
