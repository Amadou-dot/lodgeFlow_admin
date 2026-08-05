import { z } from 'zod';

import {
  BOOKING_STATUSES,
  DINING_RESERVATION_STATUSES,
  DINING_TYPES,
  EXPERIENCE_BOOKING_STATUSES,
  MEAL_TYPES,
} from '@/lib/config';

/**
 * Common pagination schema
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

/**
 * Cabin query parameters schema
 */
export const cabinQuerySchema = z.object({
  capacity: z.coerce.number().int().min(1).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  available: z
    .string()
    .transform(val => val === 'true')
    .optional(),
  search: z.string().max(200).optional(),
});

/**
 * Dining query parameters schema
 */
export const diningQuerySchema = z.object({
  type: z.enum(DINING_TYPES).optional(),
  mealType: z.enum(MEAL_TYPES).optional(),
  category: z.string().max(50).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  isPopular: z
    .string()
    .transform(val => val === 'true')
    .optional(),
  dietary: z.string().optional(), // Comma-separated dietary restrictions
  search: z.string().max(200).optional(),
});

/**
 * Experience query parameters schema
 */
export const experienceQuerySchema = z.object({
  category: z.string().max(50).optional(),
  difficulty: z.enum(['Easy', 'Moderate', 'Challenging']).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  isPopular: z
    .string()
    .transform(val => val === 'true')
    .optional(),
  tags: z.string().optional(), // Comma-separated tags
});

/**
 * Booking query parameters schema
 */
export const bookingQuerySchema = z.object({
  status: z.enum(BOOKING_STATUSES).optional(),
  checkInDate: z.coerce.date().optional(),
  checkOutDate: z.coerce.date().optional(),
  sort: z
    .enum([
      'checkInDate',
      '-checkInDate',
      'checkOutDate',
      '-checkOutDate',
      'totalPrice',
      '-totalPrice',
    ])
    .optional(),
});

/**
 * Dining reservation query parameters schema
 */
export const diningReservationQuerySchema = z.object({
  status: z.enum(DINING_RESERVATION_STATUSES).optional(),
  date: z.coerce.date().optional(),
  sort: z.enum(['date', '-date', 'time', '-time']).optional(),
});

/**
 * Experience booking query parameters schema
 */
export const experienceBookingQuerySchema = z.object({
  status: z.enum(EXPERIENCE_BOOKING_STATUSES).optional(),
  date: z.coerce.date().optional(),
  sort: z.enum(['date', '-date', 'totalPrice', '-totalPrice']).optional(),
});

export type PaginationParams = z.infer<typeof paginationSchema>;
export type CabinQueryParams = z.infer<typeof cabinQuerySchema>;
export type DiningQueryParams = z.infer<typeof diningQuerySchema>;
export type ExperienceQueryParams = z.infer<typeof experienceQuerySchema>;
export type BookingQueryParams = z.infer<typeof bookingQuerySchema>;
export type DiningReservationQueryParams = z.infer<
  typeof diningReservationQuerySchema
>;
export type ExperienceBookingQueryParams = z.infer<
  typeof experienceBookingQuerySchema
>;
