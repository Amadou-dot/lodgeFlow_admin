import { z } from 'zod';
import { objectRequestSchema } from './object-request';
export const bookingIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid booking ID');
const requestDateSchema = z.string().pipe(z.coerce.date());

import {
  BOOKING_STATUSES,
  PAYMENT_METHODS,
  REFUND_STATUSES,
} from '@/lib/config';

/**
 * Booking extras schema
 */
const extrasSelectionFields = z.strictObject({
  hasBreakfast: z.boolean().optional(),
  hasPets: z.boolean().optional(),
  hasParking: z.boolean().optional(),
  hasEarlyCheckIn: z.boolean().optional(),
  hasLateCheckOut: z.boolean().optional(),
});
const bookingExtrasSchema = objectRequestSchema.pipe(extrasSelectionFields);

/**
 * Booking status enum — uses shared constants from lib/config.ts
 */
export const bookingStatusSchema = z.enum(BOOKING_STATUSES);

/**
 * Payment method enum — uses shared constants from lib/config.ts
 */
export const paymentMethodSchema = z.enum(PAYMENT_METHODS);

/**
 * Refund status enum — uses shared constants from lib/config.ts
 */
export const refundStatusSchema = z.enum(REFUND_STATUSES);

/**
 * Create booking request schema (guest-facing)
 *
 * Pricing and receipt fields are calculated server-side and rejected as input.
 */
const createFieldsSchema = z
  .strictObject({
    cabinId: bookingIdSchema,
    checkInDate: requestDateSchema,
    checkOutDate: requestDateSchema,
    numGuests: z.number().int().min(1, 'At least 1 guest required').max(50),
    extras: bookingExtrasSchema.optional().default({}),
    specialRequests: z.array(z.string()).optional().default([]),
    observations: z.string().max(1000).optional(),
  })
  .refine(data => data.checkOutDate > data.checkInDate, {
    message: 'Check-out date must be after check-in date',
    path: ['checkOutDate'],
  });

/**
 * Update booking details schema (guest-facing PATCH for /api/bookings/[id])
 * Allows guests to update certain booking details before check-in
 */
const updateFieldsSchema = z.strictObject({
  numGuests: z.number().int().min(1).max(50).optional(),
  specialRequests: z.array(z.string()).optional(),
  extras: bookingExtrasSchema.optional(),
});

export const createBookingSchema = objectRequestSchema.pipe(createFieldsSchema);
export const updateBookingDetailsSchema =
  objectRequestSchema.pipe(updateFieldsSchema);
export const cancelBookingSchema = objectRequestSchema.pipe(
  z.strictObject({ reason: z.string().max(500).optional() })
);
export const bookingHistoryQuerySchema = z.object({
  status: bookingStatusSchema.optional(),
});
export type CreateBookingInput = z.output<typeof createBookingSchema>;
export type UpdateBookingDetailsInput = z.output<
  typeof updateBookingDetailsSchema
>;
export type CreateBookingRequest = Omit<
  z.input<typeof createFieldsSchema>,
  'extras'
> & { extras?: z.input<typeof extrasSelectionFields> };
