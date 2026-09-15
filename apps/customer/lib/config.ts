/**
 * Application-wide configuration constants
 */

/**
 * Booking Enum Values — single source of truth for TypeScript, Zod, and Mongoose
 */
import { BOOKING_STATUSES } from '@lodgeflow/database/config';
export { BOOKING_STATUSES };

import { REFUND_STATUSES } from '@lodgeflow/database/config';
export { REFUND_STATUSES };

import { PAYMENT_METHODS } from '@lodgeflow/database/config';
export { PAYMENT_METHODS };

export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export type RefundStatus = (typeof REFUND_STATUSES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/**
 * Dining Enum Values
 */
import { DINING_TYPES } from '@lodgeflow/database/config';
export { DINING_TYPES };

import { MEAL_TYPES } from '@lodgeflow/database/config';
export { MEAL_TYPES };

import { TABLE_PREFERENCES } from '@lodgeflow/database/config';
export { TABLE_PREFERENCES };

import { DINING_RESERVATION_STATUSES } from '@lodgeflow/database/config';
export { DINING_RESERVATION_STATUSES };

export type DiningType = (typeof DINING_TYPES)[number];
export type MealType = (typeof MEAL_TYPES)[number];
export type TablePreference = (typeof TABLE_PREFERENCES)[number];
export type DiningReservationStatus =
  (typeof DINING_RESERVATION_STATUSES)[number];

/**
 * Experience Enum Values
 */
import { EXPERIENCE_DIFFICULTIES } from '@lodgeflow/database/config';
export { EXPERIENCE_DIFFICULTIES };

import { EXPERIENCE_BOOKING_STATUSES } from '@lodgeflow/database/config';
export { EXPERIENCE_BOOKING_STATUSES };

export type ExperienceDifficulty = (typeof EXPERIENCE_DIFFICULTIES)[number];
export type ExperienceBookingStatus =
  (typeof EXPERIENCE_BOOKING_STATUSES)[number];
