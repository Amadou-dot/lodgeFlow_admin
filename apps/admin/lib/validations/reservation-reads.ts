import { z } from 'zod';
import { LIFECYCLES, RESERVATION_TYPES } from '@/lib/reservation-options';

export class ReservationReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReservationReadError';
    Object.setPrototypeOf(this, ReservationReadError.prototype);
  }
}
const date = z
  .string()
  .transform(value => new Date(value))
  .pipe(z.date({ error: 'Invalid date' }))
  .optional();
export const reservationQuerySchema = z
  .object({
    page: z.coerce
      .number()
      .int('Invalid pagination')
      .min(1, 'Invalid pagination')
      .max(10000, 'Invalid pagination'),
    limit: z.coerce
      .number()
      .int('Invalid pagination')
      .min(1, 'Invalid pagination')
      .max(100, 'Invalid pagination'),
    resourceId: z
      .string()
      .regex(/^[a-f0-9]{24}$/i, 'Invalid listing')
      .optional(),
    type: z
      .enum(RESERVATION_TYPES, { error: 'Invalid reservation type' })
      .optional(),
    lifecycle: z.enum(LIFECYCLES, { error: 'Invalid lifecycle' }).optional(),
    from: date,
    to: date,
  })
  .superRefine((value, context) => {
    if (value.from && value.to && value.from >= value.to)
      context.addIssue({
        code: 'custom',
        path: ['to'],
        message: 'Invalid date range',
      });
  });
export function parseReservationQuery(params: URLSearchParams) {
  const result = reservationQuerySchema.safeParse({
    page: params.get('page') ?? '1',
    limit: params.get('limit') ?? '25',
    resourceId: params.get('resourceId') || undefined,
    type: params.get('type') || undefined,
    lifecycle: params.get('lifecycle') || undefined,
    from: params.get('from') || undefined,
    to: params.get('to') || undefined,
  });
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new ReservationReadError(
      issue.path[0] === 'page' || issue.path[0] === 'limit'
        ? 'Invalid pagination'
        : issue.message
    );
  }
  return result.data;
}
const calendarRangeSchema = z
  .object({
    start: z.date({ error: 'Invalid date range' }),
    end: z.date({ error: 'Invalid date range' }),
  })
  .superRefine((value, context) => {
    if (value.end <= value.start)
      context.addIssue({
        code: 'custom',
        path: ['end'],
        message: 'Invalid date range',
      });
  })
  .transform(({ start, end }) => {
    const normalizedStart = new Date(start),
      normalizedEnd = new Date(end);
    normalizedStart.setUTCHours(0, 0, 0, 0);
    normalizedEnd.setUTCHours(0, 0, 0, 0);
    return { start: normalizedStart, end: normalizedEnd };
  })
  .refine(value => value.end > value.start, {
    path: ['end'],
    message: 'End date must be after start date',
  })
  .transform(({ start, end }) => ({
    start,
    end: new Date(Math.min(end.getTime(), start.getTime() + 180 * 86_400_000)),
  }));
export function parseCalendarRange(params: URLSearchParams) {
  const now = new Date();
  const startInput = params.get('start'),
    endInput = params.get('end');
  const start = startInput
    ? new Date(startInput)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = endInput
    ? new Date(endInput)
    : new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  const result = calendarRangeSchema.safeParse({ start, end });
  if (!result.success)
    throw new ReservationReadError(result.error.issues[0].message);
  return result.data;
}
