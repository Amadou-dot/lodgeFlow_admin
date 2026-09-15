import { z } from 'zod';

import { EXPERIENCE_BOOKING_STATUSES } from '@/lib/config';

/**
 * Experience booking status enum
 */
export const experienceBookingStatusSchema = z.enum(
  EXPERIENCE_BOOKING_STATUSES
);

/**
 * Create experience booking request schema (guest-facing)
 */
export const createExperienceBookingSchema = z
  .object({
    experienceId: z.string().min(1, 'Experience ID is required'),
    date: z.coerce.date(),
    timeSlot: z.string().max(50).optional(),
    numParticipants: z
      .number()
      .int()
      .min(1, 'At least 1 participant required')
      .max(500),
    specialRequests: z.array(z.string()).optional().default([]),
    observations: z.string().max(1000).optional(),
  })
  .refine(
    data => {
      // Date should not be in the past
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const bookingDate = new Date(data.date);
      bookingDate.setHours(0, 0, 0, 0);
      return bookingDate >= now;
    },
    {
      message: 'Cannot book a date in the past',
      path: ['date'],
    }
  );

/**
 * Update experience booking request schema (guest-facing PATCH)
 */
export const patchExperienceBookingSchema = z.object({
  status: experienceBookingStatusSchema.optional(),
  cancellationReason: z.string().max(500).optional(),
  stripePaymentIntentId: z
    .string()
    .startsWith('pi_', 'Invalid Stripe payment intent ID')
    .max(255)
    .optional(),
});

export type CreateExperienceBookingInput = z.infer<
  typeof createExperienceBookingSchema
>;
export type PatchExperienceBookingInput = z.infer<
  typeof patchExperienceBookingSchema
>;
