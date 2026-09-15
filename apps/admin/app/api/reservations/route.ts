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
    return createErrorResponse(
      error instanceof Error ? error.message : 'Invalid query',
      400
    );
  }
  try {
    await connectDB();
    const [result] = await Booking.aggregate(query.pipeline).allowDiskUse(true);
    const ids: string[] = Array.from(
      new Set<string>(
        result.rows.map((row: { customer: string }) => row.customer)
      )
    );
    const customers = await getClerkUsersBatch(ids);
    const rows = result.rows.map((row: { customer: string }) => ({
      ...row,
      customerName:
        customers.users.get(row.customer)?.name || 'Unavailable guest',
    }));
    return createSuccessResponse({
      rows,
      total: result.total[0]?.count ?? 0,
      page: query.page,
      limit: query.limit,
    });
  } catch {
    return createErrorResponse('Unable to load reservations', 500);
  }
}
