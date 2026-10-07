import { objectRequestSchema } from './object-request';
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
const createBodySchema = z
  .strictObject({
    experienceId: z
      .string()
      .min(1, 'Experience ID is required')
      .regex(/^[a-f\d]{24}$/i, 'Invalid listing ID'),
    date: z.string().pipe(z.coerce.date()),
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

export const createExperienceBookingSchema =
  objectRequestSchema.pipe(createBodySchema);

export type CreateExperienceBookingInput = z.infer<
  typeof createExperienceBookingSchema
>;
const updateBodySchema = z.strictObject({
  date: z.string().pipe(z.coerce.date()).optional(),
  timeSlot: z.string().max(50).optional(),
  numParticipants: z.number().int().min(1).max(500).optional(),
  specialRequests: z.array(z.string()).optional(),
  observations: z.string().max(1000).optional(),
});

export type CreateExperienceBookingRequest = z.input<typeof createBodySchema>;

export const updateExperienceDetailsSchema =
  objectRequestSchema.pipe(updateBodySchema);
export type PatchExperienceBookingInput = z.output<
  typeof updateExperienceDetailsSchema
>;
