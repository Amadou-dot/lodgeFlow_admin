import {
  BOOKING_STATUSES,
  PAYMENT_METHODS,
  REFUND_STATUSES,
} from '@/lib/config';
import { z } from 'zod';

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
 * Create booking request schema
 */
export const createBookingSchema = z
  .object({
    cabin: z.string().min(1, 'Cabin is required'),
    customer: z.string().min(1, 'Customer is required'),
    checkInDate: z.coerce.date(),
    checkOutDate: z.coerce.date(),
    numGuests: z.number().int().min(1, 'At least 1 guest required').max(50),
    // numNights, cabinPrice, extrasPrice, and totalPrice are optional here
    // because the API route recomputes them server-side from the cabin and
    // settings documents (see calculateBookingPricing in lib/booking-pricing.ts)
    // — any client-supplied values for these fields are ignored on create.
    numNights: z.number().int().min(1).optional(),
    status: bookingStatusSchema.optional().default('unconfirmed'),
    cabinPrice: z.number().min(0).optional(),
    extrasPrice: z.number().min(0).optional().default(0),
    totalPrice: z.number().min(0).optional(),
    isPaid: z.boolean().optional().default(false),
    paymentMethod: paymentMethodSchema.optional(),
    depositPaid: z.boolean().optional().default(false),
    depositAmount: z.number().min(0).optional().default(0),
    stripePaymentIntentId: z.string().startsWith('pi_').max(255).optional(),
    stripeSessionId: z.string().startsWith('cs_').max(255).optional(),
    paidAt: z.coerce.date().optional(),
    paymentConfirmationSentAt: z.coerce.date().optional(),
    remainingAmount: z.number().min(0).optional(),
    extras: bookingExtrasSchema.optional(),
    observations: z.string().max(1000).optional(),
    specialRequests: z.array(z.string()).optional().default([]),
  })
  .refine(data => data.checkOutDate > data.checkInDate, {
    message: 'Check-out date must be after check-in date',
    path: ['checkOutDate'],
  });

/**
 * Update booking request schema (all fields optional except _id)
 */
export const updateBookingSchema = z
  .object({
    _id: z.string().min(1, 'Booking ID is required'),
    cabin: z.string().min(1).optional(),
    customer: z.string().min(1).optional(),
    checkInDate: z.coerce.date().optional(),
    checkOutDate: z.coerce.date().optional(),
    numGuests: z.number().int().min(1).max(50).optional(),
    // numNights, cabinPrice, extrasPrice, and totalPrice are accepted here for
    // schema shape only — the API route recomputes them server-side from the
    // cabin and settings documents whenever a pricing-relevant field (cabin,
    // dates, numGuests, extras) changes, and otherwise ignores any
    // client-supplied value outright (see calculateBookingPricing in
    // lib/booking-pricing.ts and issue #122).
    numNights: z.number().int().min(1).optional(),
    status: bookingStatusSchema.optional(),
    cabinPrice: z.number().min(0).optional(),
    extrasPrice: z.number().min(0).optional(),
    totalPrice: z.number().min(0).optional(),
    isPaid: z.boolean().optional(),
    paymentMethod: paymentMethodSchema.optional(),
    depositPaid: z.boolean().optional(),
    depositAmount: z.number().min(0).optional(),
    stripePaymentIntentId: z.string().startsWith('pi_').max(255).optional(),
    stripeSessionId: z.string().startsWith('cs_').max(255).optional(),
    paidAt: z.coerce.date().optional(),
    cancelledAt: z.coerce.date().optional(),
    cancellationReason: z.string().max(500).optional(),
    refundStatus: refundStatusSchema.optional(),
    refundAmount: z.number().min(0).optional(),
    refundedAt: z.coerce.date().optional(),
    paymentConfirmationSentAt: z.coerce.date().optional(),
    remainingAmount: z.number().min(0).optional(),
    extras: bookingExtrasSchema.optional(),
    observations: z.string().max(1000).optional(),
    specialRequests: z.array(z.string()).optional(),
  })
  .refine(
    data => {
      if (data.checkInDate && data.checkOutDate) {
        return data.checkOutDate > data.checkInDate;
      }
      return true;
    },
    {
      message: 'Check-out date must be after check-in date',
      path: ['checkOutDate'],
    }
  );

/**
 * Record payment schema (for PATCH /api/bookings/[id])
 */
export const recordPaymentSchema = z.object({
  paymentMethod: paymentMethodSchema,
  amountPaid: z.number().positive('Payment amount must be positive'),
  notes: z.string().max(500).optional(),
});

/**
 * Booking PATCH request schema
 */
export const patchBookingSchema = z
  .object({
    status: bookingStatusSchema.optional(),
    cancellationReason: z.string().max(500).optional(),
    cancelledAt: z.coerce.date().optional(),
    refundStatus: refundStatusSchema.optional(),
    refundAmount: z.number().min(0).optional(),
    refundedAt: z.coerce.date().optional(),
    paidAt: z.coerce.date().optional(),
    stripePaymentIntentId: z.string().startsWith('pi_').max(255).optional(),
    stripeSessionId: z.string().startsWith('cs_').max(255).optional(),
    paymentConfirmationSentAt: z.coerce.date().optional(),
    recordPayment: recordPaymentSchema.optional(),
  })
  .refine(data => !(data.recordPayment && data.paidAt), {
    message: 'Cannot specify both recordPayment and paidAt',
    path: ['paidAt'],
  });

export type CreateBookingInput = z.input<typeof createBookingSchema>;
export type UpdateBookingInput = z.input<typeof updateBookingSchema>;
export type PatchBookingInput = z.input<typeof patchBookingSchema>;
