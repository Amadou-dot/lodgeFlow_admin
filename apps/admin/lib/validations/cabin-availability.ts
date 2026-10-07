import { z } from 'zod';

const objectId = (message: string) =>
  z.string().regex(/^[a-f0-9]{24}$/i, message);
const queryDate = (field: string) =>
  z
    .string()
    .transform(value => new Date(value))
    .pipe(z.date(`Invalid ${field}`));

export const cabinAvailabilityQuerySchema = z
  .object({
    // Retain exclusion error precedence when several query fields are invalid.
    excludeBookingId: objectId('Invalid excludeBookingId format').optional(),
    cabinId: objectId('Invalid cabinId format'),
    startDate: queryDate('startDate'),
    endDate: queryDate('endDate'),
  })
  .refine(value => value.endDate > value.startDate, {
    path: ['endDate'],
    message: 'endDate must be after startDate',
  });

const dateRangeSchema = z.object({ start: z.iso.date(), end: z.iso.date() });

export const cabinAvailabilityResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    cabinId: z.string(),
    unavailableDates: z.array(dateRangeSchema),
    queryRange: dateRangeSchema,
  }),
});
