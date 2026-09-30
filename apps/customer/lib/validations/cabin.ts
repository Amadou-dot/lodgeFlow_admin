import { z } from 'zod';

export const cabinIdSchema = z.string().regex(/^[a-f\d]{24}$/i);

const requiredAvailabilityFields =
  'Missing required fields: checkInDate, checkOutDate, guests';

// JSON carries strings. Convert once without truncating time or offset data.
const availabilityDate = z
  .string({ error: requiredAvailabilityFields })
  .min(1, requiredAvailabilityFields)
  .pipe(z.coerce.date({ error: 'Invalid availability date' }));

export const cabinAvailabilitySchema = z
  .object({
    checkInDate: availabilityDate,
    checkOutDate: availabilityDate,
    guests: z
      .number({ error: requiredAvailabilityFields })
      .int('Guests must be a positive integer')
      .min(1, requiredAvailabilityFields),
  })
  .refine(input => input.checkOutDate > input.checkInDate, {
    message: 'Check-out date must be after check-in date',
    path: ['checkOutDate'],
  });

const calendarQueryDate = z
  .string()
  .pipe(z.coerce.date({ error: 'Invalid availability date' }));

export const cabinCalendarQuerySchema = z
  .object({
    startDate: calendarQueryDate.optional(),
    endDate: calendarQueryDate.optional(),
  })
  .transform(({ startDate, endDate }) => {
    const defaultStart = new Date();
    const defaultEnd = new Date();
    // Preserve calendar-month rollover and the server's existing timezone rules.
    defaultEnd.setMonth(defaultEnd.getMonth() + 6);
    return {
      startDate: startDate ?? defaultStart,
      endDate: endDate ?? defaultEnd,
    };
  })
  .refine(input => input.endDate > input.startDate, {
    message: 'End date must be after start date',
    path: ['endDate'],
  });
