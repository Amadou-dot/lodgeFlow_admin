import { serializeUnpopulatedReservation } from '@lodgeflow/database/reservation-json';
import Stripe from 'stripe';
import { reservationReceiptSchema } from './validations/reservation-payment';
import { readJsonRequestBody } from './validations/request-body';
import { logger } from './logger';
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

export async function reservationPayment(
  request: Request,
  { id, kind }: { id: string; kind: 'dining' | 'experience' }
) {
  const access = await requireApiAuth({ permission: 'bookings:manage' });
  if (!access.authenticated) return access.error;
  try {
    const body = await readJsonRequestBody(request);
    if (!body.success) return createErrorResponse('Invalid JSON', 400);
    const parsed = reservationReceiptSchema.safeParse(body.data);
    if (!parsed.success)
      return createErrorResponse(parsed.error.issues[0].message, 400);
    if (parsed.data.type === 'refund') {
      const refundAccess = await requireApiAuth({
        permission: 'refunds:issue',
      });
      if (!refundAccess.authenticated) return refundAccess.error;
    }
    await connectDB();
    if (parsed.data.method === 'stripe') {
      const result = await refundReservationStripe({
        kind,
        id,
        token: parsed.data.id,
        amountCents: parsed.data.amountCents,
        actor: access.userId,
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
      receipt: { ...parsed.data, actor: access.userId },
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
    return createSuccessResponse(
      serializeUnpopulatedReservation(result.reservation)
    );
  } catch (error: unknown) {
    if (error instanceof ReservationRuleError)
      return createErrorResponse(error.message, error.status);
    logger.error('Unable to record transaction', error);
    return createErrorResponse('Unable to record transaction', 500);
  }
}
