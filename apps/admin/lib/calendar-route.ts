import {
  createErrorResponse,
  createSuccessResponse,
  requireApiAuth,
} from './api-utils';
import connectDB from './mongodb';
import {
  cabinCalendar,
  calendarRange,
  capacityCalendar,
} from './reservation-reads';
export async function calendarResponse(
  request: Request,
  kind: 'cabins' | 'dining' | 'experiences'
) {
  const access = await requireApiAuth({ permission: 'bookings:read' });
  if (!access.authenticated) return access.error;
  let range;
  try {
    range = calendarRange(new URL(request.url).searchParams);
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Invalid date range',
      400
    );
  }
  try {
    await connectDB();
    const data =
      kind === 'cabins'
        ? await cabinCalendar(range.start, range.end)
        : await capacityCalendar(
            kind === 'dining' ? 'dining' : 'experience',
            range.start,
            range.end
          );
    return createSuccessResponse({
      ...data,
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    });
  } catch {
    return createErrorResponse('Unable to load calendar', 500);
  }
}
