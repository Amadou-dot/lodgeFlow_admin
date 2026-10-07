import { ReservationReadError } from '@/lib/validations/reservation-reads';
import { logger } from '@/lib/logger';
import {
  serializeReservationRow,
  type ReservationInboxSource,
} from '@/lib/serializers/reservation-calendar';
import type { ReservationInboxJson } from '@/types/reservation-calendar';
import { Booking } from '@lodgeflow/database';
import {
  createErrorResponse,
  createSuccessResponse,
  requireApiAuth,
} from '@/lib/api-utils';
import { getClerkUsersBatch } from '@/lib/clerk-users';
import connectDB from '@/lib/mongodb';
import { reservationPipeline } from '@/lib/reservation-reads';
export async function GET(request: Request) {
  const access = await requireApiAuth({ permission: 'bookings:read' });
  if (!access.authenticated) return access.error;
  let query;
  try {
    query = reservationPipeline(new URL(request.url).searchParams);
  } catch (error) {
    if (error instanceof ReservationReadError)
      return createErrorResponse(error.message, 400);
    logger.error('Unable to load reservations', error);
    return createErrorResponse('Unable to load reservations', 500);
  }
  try {
    await connectDB();
    const [result] = await Booking.aggregate<ReservationInboxSource>(
      query.pipeline
    ).allowDiskUse(true);
    const ids: string[] = Array.from(
      new Set<string>(result.rows.map(row => row.customer))
    );
    const customers = await getClerkUsersBatch(ids);
    const rows = result.rows.map(row =>
      serializeReservationRow({
        row,
        customerName:
          customers.users.get(row.customer)?.name || 'Unavailable guest',
      })
    );
    return createSuccessResponse<ReservationInboxJson>({
      rows,
      total: result.total[0]?.count ?? 0,
      page: query.page,
      limit: query.limit,
    });
  } catch (error: unknown) {
    logger.error('Unable to load reservations', error);
    return createErrorResponse('Unable to load reservations', 500);
  }
}
