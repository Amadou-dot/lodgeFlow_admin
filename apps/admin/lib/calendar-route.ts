import { ReservationReadError } from './validations/reservation-reads';
import { logger } from './logger';
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
    if (error instanceof ReservationReadError)
      return createErrorResponse(error.message, 400);
    logger.error('Unable to load calendar', error);
    return createErrorResponse('Unable to load calendar', 500);
  }
  try {
    await connectDB();
    const data =
      kind === 'cabins'
        ? await cabinCalendar(range)
        : await capacityCalendar({
            kind: kind === 'dining' ? 'dining' : 'experience',
            ...range,
          });
    return createSuccessResponse({
      ...data,
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    });
  } catch (error: unknown) {
    logger.error('Unable to load calendar', error);
    return createErrorResponse('Unable to load calendar', 500);
  }
}
