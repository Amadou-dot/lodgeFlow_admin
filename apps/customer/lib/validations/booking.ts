import { z } from 'zod';

import {
  BOOKING_STATUSES,
  PAYMENT_METHODS,
  REFUND_STATUSES,
} from '@/lib/config';

/**
 * Booking extras schema
 */
const bookingExtrasSchema = z.object({
  hasBreakfast: z.boolean().optional().default(false),
  breakfastPrice: z.number().min(0).optional().default(0),
  hasPets: z.boolean().optional().default(false),
  petFee: z.number().min(0).optional().default(0),
  hasParking: z.boolean().optional().default(false),
  parkingFee: z.number().min(0).optional().default(0),
  hasEarlyCheckIn: z.boolean().optional().default(false),
  earlyCheckInFee: z.number().min(0).optional().default(0),
  hasLateCheckOut: z.boolean().optional().default(false),
  lateCheckOutFee: z.number().min(0).optional().default(0),
});

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
 * Note: cabinPrice, numNights, totalPrice are calculated server-side,
 * so they're optional in the request but required before saving to DB.
 */
export const createBookingSchema = z
  .object({
    cabinId: z.string().min(1, 'Cabin ID is required'),
    checkInDate: z.coerce.date(),
    checkOutDate: z.coerce.date(),
    numGuests: z.number().int().min(1, 'At least 1 guest required').max(50),
    extras: bookingExtrasSchema.optional().default({
      hasBreakfast: false,
      breakfastPrice: 0,
      hasPets: false,
      petFee: 0,
      hasParking: false,
      parkingFee: 0,
      hasEarlyCheckIn: false,
      earlyCheckInFee: 0,
      hasLateCheckOut: false,
      lateCheckOutFee: 0,
    }),
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
export const updateBookingDetailsSchema = z.object({
  numGuests: z.number().int().min(1).max(50).optional(),
  specialRequests: z.array(z.string()).optional(),
  extras: bookingExtrasSchema.optional(),
});

/**
 * Update booking request schema (admin-facing or internal PATCH)
 * Used for updating booking status, cancellation, or payment info
 */
export const patchBookingSchema = z.object({
  status: bookingStatusSchema.optional(),
  cancellationReason: z.string().max(500).optional(),
  stripePaymentIntentId: z
    .string()
    .startsWith('pi_', 'Invalid Stripe payment intent ID')
    .max(255)
    .optional(),
  stripeSessionId: z
    .string()
    .startsWith('cs_', 'Invalid Stripe session ID')
    .max(255)
    .optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type UpdateBookingDetailsInput = z.infer<
  typeof updateBookingDetailsSchema
>;
export type PatchBookingInput = z.infer<typeof patchBookingSchema>;
