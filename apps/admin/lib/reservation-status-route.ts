import mongoose from 'mongoose';
import {
  DiningReservation,
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
import connectDB from './mongodb';
type Kind = 'dining' | 'experience';
export async function reservationDetails(id: string, kind: Kind) {
  const access = await requireApiAuth({ permission: 'bookings:read' });
  if (!access.authenticated) return access.error;
  if (!mongoose.isValidObjectId(id))
    return createErrorResponse('Invalid reservation ID', 400);
  try {
    await connectDB();
    const reservation =
      kind === 'dining'
        ? await DiningReservation.findById(id).populate('dining')
        : await ExperienceBooking.findById(id).populate('experience');
    if (!reservation) return createErrorResponse('Reservation not found', 404);
    const customer = await getClerkUser(reservation.customer).catch(() => null);
    const transitions =
      kind === 'dining'
        ? DINING_STATUS_TRANSITIONS
        : EXPERIENCE_STATUS_TRANSITIONS;
    return createSuccessResponse({
      reservation,
      customerName: customer?.name || 'Unavailable guest',
      allowedStatuses: transitions[reservation.status] ?? [],
    });
  } catch {
    return createErrorResponse('Unable to load reservation', 500);
  }
}
export async function changeReservationStatus(
  request: Request,
  id: string,
  kind: Kind
) {
  const access = await requireApiAuth({ permission: 'bookings:manage' });
  if (!access.authenticated) return access.error;
  let body;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse('Invalid JSON', 400);
  }
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    typeof body.status !== 'string' ||
    typeof body.expectedStatus !== 'string' ||
    Object.keys(body).some(key => !['status', 'expectedStatus'].includes(key))
  )
    return createErrorResponse(
      'Only status and expectedStatus are accepted',
      400
    );
  try {
    await connectDB();
    const result = await transitionCapacityReservation(
      kind,
      id,
      body.expectedStatus,
      body.status
    );
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
    return createSuccessResponse(result.reservation);
  } catch (error) {
    if (error instanceof ReservationRuleError)
      return createErrorResponse(error.message, error.status);
    return createErrorResponse('Unable to change reservation status', 500);
  }
}
