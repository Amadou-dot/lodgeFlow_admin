import { objectRequestSchema } from './object-request';
import { z } from 'zod';

import { DINING_RESERVATION_STATUSES, TABLE_PREFERENCES } from '@/lib/config';

/**
 * Time format regex (HH:MM)
 */
const timeRegex = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/**
 * Dining reservation status enum
 */
export const diningReservationStatusSchema = z.enum(
  DINING_RESERVATION_STATUSES
);

/**
 * Table preference enum
 */
export const tablePreferenceSchema = z.enum(TABLE_PREFERENCES);

/**
 * Create dining reservation request schema (guest-facing)
 */
const createBodySchema = z
  .strictObject({
    diningId: z
      .string()
      .min(1, 'Dining ID is required')
      .regex(/^[a-f\d]{24}$/i, 'Invalid listing ID'),
    date: z.string().pipe(z.coerce.date()),
    time: z
      .string()
      .regex(timeRegex, 'Time must be in HH:MM format (e.g., 14:30)'),
    numGuests: z.number().int().min(1, 'At least 1 guest required').max(100),
    dietaryRequirements: z.array(z.string()).optional().default([]),
    specialRequests: z.array(z.string()).optional().default([]),
    tablePreference: tablePreferenceSchema.optional().default('no-preference'),
    occasion: z.string().max(100).optional(),
  })
  .refine(
    data => {
      // Date should not be in the past (compare date-only)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const reservationDay = new Date(data.date);
      reservationDay.setHours(0, 0, 0, 0);
      return reservationDay >= today;
    },
    {
      message: 'Cannot reserve a date in the past',
      path: ['date'],
    }
  );

export const createDiningReservationSchema =
  objectRequestSchema.pipe(createBodySchema);

export type CreateDiningReservationInput = z.infer<
  typeof createDiningReservationSchema
>;
const updateBodySchema = z.strictObject({
  date: z.string().pipe(z.coerce.date()).optional(),
  time: z.string().regex(timeRegex).optional(),
  numGuests: z.number().int().min(1).max(100).optional(),
  dietaryRequirements: z.array(z.string()).optional(),
  specialRequests: z.array(z.string()).optional(),
  tablePreference: tablePreferenceSchema.optional(),
  occasion: z.string().max(100).optional(),
});

export type CreateDiningReservationRequest = z.input<typeof createBodySchema>;

export const updateDiningDetailsSchema =
  objectRequestSchema.pipe(updateBodySchema);
export type PatchDiningReservationInput = z.output<
  typeof updateDiningDetailsSchema
>;
