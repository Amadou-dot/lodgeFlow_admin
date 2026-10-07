import { readJsonRequestBody } from './validations/request-body';
import {
  serializeDiningReservationDetail,
  serializeExperienceReservationDetail,
  serializeUnpopulatedReservation,
} from '@lodgeflow/database/reservation-json';
import type { DiningJsonSource } from '@lodgeflow/database/dining-json';
import type { ExperienceJsonSource } from '@lodgeflow/database/experience-json';
import mongoose from 'mongoose';
import {
  DiningReservation,
  reservationPaymentSummary,
  Settings,
  ExperienceBooking,
  ReservationRuleError,
  transitionCapacityReservation,
} from '@lodgeflow/database';
import {
  DINING_STATUS_TRANSITIONS,
  EXPERIENCE_STATUS_TRANSITIONS,
} from '@lodgeflow/database/config';
import {
  createErrorResponse,
  createSuccessResponse,
  requireApiAuth,
} from './api-utils';
import { recordAudit } from './audit';
import { getClerkUser } from './clerk-users';
import { logger } from './logger';
import connectDB from './mongodb';
import { reservationStatusSchema } from './validations/reservation-status';

interface ReservationReference {
  reservationId: string;
  kind: 'dining' | 'experience';
}
export async function reservationDetails({
  reservationId: id,
  kind,
}: ReservationReference) {
  const access = await requireApiAuth({ permission: 'bookings:read' });
  if (!access.authenticated) return access.error;
  if (!mongoose.isValidObjectId(id))
    return createErrorResponse('Invalid reservation ID', 400);
  try {
    await connectDB();
    const reservation =
      kind === 'dining'
        ? await DiningReservation.findById(id).populate<{
            dining: DiningJsonSource | null;
          }>('dining')
        : await ExperienceBooking.findById(id).populate<{
            experience: ExperienceJsonSource | null;
          }>('experience');
    if (!reservation) return createErrorResponse('Reservation not found', 404);
    const customer = await getClerkUser(reservation.customer).catch(() => null);
    const transitions =
      kind === 'dining'
        ? DINING_STATUS_TRANSITIONS
        : EXPERIENCE_STATUS_TRANSITIONS;
    return createSuccessResponse({
      reservation:
        'dining' in reservation
          ? serializeDiningReservationDetail(reservation.toObject())
          : serializeExperienceReservationDetail(reservation.toObject()),
      payment: reservationPaymentSummary(reservation),
      currency: (await Settings.getSettings()).currency,
      customerName: customer?.name || 'Unavailable guest',
      allowedStatuses: transitions[reservation.status] ?? [],
    });
  } catch (error: unknown) {
    logger.error(
      'Error loading reservation',
      error instanceof Error ? error : undefined
    );
    return createErrorResponse('Unable to load reservation', 500);
  }
}
export async function changeReservationStatus({
  request,
  reservationId: id,
  kind,
}: ReservationReference & { request: Request }) {
  const access = await requireApiAuth({ permission: 'bookings:manage' });
  if (!access.authenticated) return access.error;
  try {
    const body = await readJsonRequestBody(request);
    if (!body.success) return createErrorResponse('Invalid JSON', 400);
    const parsed = reservationStatusSchema.safeParse(body.data);
    if (!parsed.success)
      return createErrorResponse(
        'Only status and expectedStatus are accepted',
        400
      );
    await connectDB();
    const result = await transitionCapacityReservation({
      kind,
      reservationId: id,
      expectedStatus: parsed.data.expectedStatus,
      nextStatus: parsed.data.status,
    });
    if (result.changed)
      await recordAudit(access, {
        action:
          kind === 'dining'
            ? 'dining_reservation.status_change'
            : 'experience_booking.status_change',
        resourceType:
          kind === 'dining' ? 'dining_reservation' : 'experience_booking',
        resourceId: id,
        before: { status: result.beforeStatus },
        after: { status: result.reservation.status },
      });
    return createSuccessResponse(
      serializeUnpopulatedReservation(result.reservation)
    );
  } catch (error: unknown) {
    if (error instanceof ReservationRuleError)
      return createErrorResponse(error.message, error.status);
    logger.error(
      'Error changing reservation status',
      error instanceof Error ? error : undefined
    );
    return createErrorResponse('Unable to change reservation status', 500);
  }
}
