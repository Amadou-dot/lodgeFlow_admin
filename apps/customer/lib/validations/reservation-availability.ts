import { z } from 'zod';
const rangeDate = z
  .string()
  .pipe(z.coerce.date({ error: 'Invalid date range parameters' }));
const day = z.object({
  kind: z.literal('day'),
  date: z
    .string()
    .refine(
      value => Number.isFinite(Date.parse(value)),
      'Invalid date parameter'
    ),
  time: z
    .string()
    .regex(
      /^([01]\d|2[0-3]):([0-5]\d)$/,
      'Invalid time format. Expected HH:MM (e.g., 14:30)'
    )
    .optional(),
});
const range = z
  .object({
    kind: z.literal('range'),
    startDate: rangeDate,
    endDate: rangeDate,
  })
  .superRefine((data, context) => {
    if (data.endDate <= data.startDate)
      context.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'End date must be after start date',
      });
  });
// A specific date retains precedence over range fields, as in the existing API.
export const reservationAvailabilityQuerySchema = z
  .object({
    date: z.string().optional(),
    time: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  })
  .transform(input => {
    if (input.date)
      return {
        kind: 'day' as const,
        date: input.date,
        time: input.time || undefined,
      };
    const defaultStart = new Date();
    const defaultEnd = new Date();
    defaultEnd.setMonth(defaultEnd.getMonth() + 3);
    return {
      kind: 'range' as const,
      startDate: input.startDate || defaultStart.toISOString(),
      endDate: input.endDate || defaultEnd.toISOString(),
    };
  })
  .pipe(z.discriminatedUnion('kind', [day, range]))
  .transform(input =>
    input.kind === 'day'
      ? {
          kind: 'day' as const,
          dateParam: input.date,
          checkDate: new Date(input.date),
          timeParam: input.time,
        }
      : {
          kind: 'range' as const,
          queryStart: input.startDate,
          queryEnd: new Date(
            Math.min(
              input.endDate.getTime(),
              input.startDate.getTime() + 180 * 86400000
            )
          ),
        }
  );

export const diningDayAvailabilitySchema = z.object({
  diningId: z.string(),
  date: z.string(),
  time: z.string().nullable(),
  seatsRemaining: z.number().nullable(),
  maxPeople: z.number().nullable(),
  isAvailable: z.boolean(),
  servingTime: z.object({ start: z.string(), end: z.string() }),
  reason: z.string().optional(),
});
