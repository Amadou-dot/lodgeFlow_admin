import { z } from 'zod';

import { DINING_RESERVATION_STATUSES, TABLE_PREFERENCES } from '@/lib/config';

/**
 * Time format regex (HH:MM)
 */
const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

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
export const createDiningReservationSchema = z
  .object({
    diningId: z.string().min(1, 'Dining ID is required'),
    date: z.coerce.date(),
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

/**
 * Update dining reservation request schema (guest-facing PATCH)
 */
export const patchDiningReservationSchema = z.object({
  status: diningReservationStatusSchema.optional(),
  cancellationReason: z.string().max(500).optional(),
  stripePaymentIntentId: z
    .string()
    .startsWith('pi_', 'Invalid Stripe payment intent ID')
    .max(255)
    .optional(),
});

export type CreateDiningReservationInput = z.infer<
  typeof createDiningReservationSchema
>;
export type PatchDiningReservationInput = z.infer<
  typeof patchDiningReservationSchema
>;
