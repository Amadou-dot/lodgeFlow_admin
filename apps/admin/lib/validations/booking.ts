import { receiptAmountSchema } from './money';
import { objectRequestSchema } from './object-request';
import {
  BOOKING_STATUSES,
  PAYMENT_METHODS,
  REFUND_STATUSES,
} from '@/lib/config';
import { z } from 'zod';

export const bookingIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid booking ID');
const requestDateSchema = z.string().pipe(z.coerce.date());

/**
 * Booking extras schema
 */
const bookingExtrasFields = z.strictObject({
  hasBreakfast: z.boolean().optional().default(false),
  hasPets: z.boolean().optional().default(false),
  hasParking: z.boolean().optional().default(false),
  hasEarlyCheckIn: z.boolean().optional().default(false),
  hasLateCheckOut: z.boolean().optional().default(false),
});
const bookingExtrasSchema = objectRequestSchema.pipe(bookingExtrasFields);

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
const createFieldsSchema = z
  .strictObject({
    cabin: bookingIdSchema,
    customer: z.string().min(1, 'Customer is required'),
    checkInDate: requestDateSchema,
    checkOutDate: requestDateSchema,
    numGuests: z.number().int().min(1, 'At least 1 guest required').max(50),
    status: bookingStatusSchema.optional().default('unconfirmed'),
    paymentMethod: paymentMethodSchema.optional(),
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
const updateFieldsSchema = z
  .strictObject({
    _id: bookingIdSchema,
    cabin: bookingIdSchema.optional(),
    customer: z.string().min(1).optional(),
    checkInDate: requestDateSchema.optional(),
    checkOutDate: requestDateSchema.optional(),
    numGuests: z.number().int().min(1).max(50).optional(),
    status: bookingStatusSchema.optional(),
    paymentMethod: paymentMethodSchema.optional(),
    cancelledAt: requestDateSchema.optional(),
    cancellationReason: z.string().max(500).optional(),
    refundStatus: refundStatusSchema.optional(),
    refundAmount: z.number().min(0).pipe(receiptAmountSchema).optional(),
    refundedAt: requestDateSchema.optional(),
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
const recordPaymentFields = z.strictObject({
  receiptId: z.string().uuid().optional(),
  paymentMethod: paymentMethodSchema,
  amountPaid: z
    .number()
    .positive('Payment amount must be positive')
    .pipe(receiptAmountSchema),
  notes: z.string().max(500).optional(),
});
export const recordPaymentSchema =
  objectRequestSchema.pipe(recordPaymentFields);

/**
 * Booking PATCH request schema
 */
const patchFieldsSchema = z
  .strictObject({
    status: bookingStatusSchema.optional(),
    cancellationReason: z.string().max(500).optional(),
    cancelledAt: requestDateSchema.optional(),
    refundStatus: refundStatusSchema.optional(),
    refundAmount: z.number().min(0).pipe(receiptAmountSchema).optional(),
    refundedAt: requestDateSchema.optional(),
    paidAt: requestDateSchema.optional(),
    stripePaymentIntentId: z.string().startsWith('pi_').max(255).optional(),
    stripeSessionId: z.string().startsWith('cs_').max(255).optional(),
    paymentConfirmationSentAt: requestDateSchema.optional(),
    recordPayment: recordPaymentSchema.optional(),
  })
  .refine(data => !(data.recordPayment && data.paidAt), {
    message: 'Cannot specify both recordPayment and paidAt',
    path: ['paidAt'],
  });

export const createBookingSchema = objectRequestSchema.pipe(createFieldsSchema);
export const updateBookingSchema = objectRequestSchema.pipe(
  updateFieldsSchema.refine(
    data =>
      !(
        data.refundStatus === 'none' &&
        data.refundAmount !== undefined &&
        data.refundAmount > 0
      ),
    {
      path: ['refundStatus'],
      message:
        'refundStatus must be "partial" or "full" when setting a non-zero refundAmount',
    }
  )
);
export const patchBookingSchema = objectRequestSchema.pipe(
  patchFieldsSchema.refine(
    data =>
      !(
        data.refundStatus === 'none' &&
        data.refundAmount !== undefined &&
        data.refundAmount > 0
      ),
    {
      path: ['refundStatus'],
      message:
        'refundStatus must be "partial" or "full" when setting a non-zero refundAmount',
    }
  )
);

export type CreateBookingInput = Omit<
  z.input<typeof createFieldsSchema>,
  'extras'
> & { extras?: z.input<typeof bookingExtrasFields> };
export type UpdateBookingInput = Omit<
  z.input<typeof updateFieldsSchema>,
  'extras'
> & { extras?: z.input<typeof bookingExtrasFields> };
export type PatchBookingInput = Omit<
  z.input<typeof patchFieldsSchema>,
  'recordPayment'
> & { recordPayment?: z.input<typeof recordPaymentFields> };
