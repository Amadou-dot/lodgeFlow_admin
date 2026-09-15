/**
 * Application-wide configuration constants
 */

/**
 * Booking Enum Values — single source of truth for TypeScript, Zod, and Mongoose
 */
export const BOOKING_STATUSES = [
  'unconfirmed',
  'confirmed',
  'checked-in',
  'checked-out',
  'cancelled',
] as const;

export const REFUND_STATUSES = [
  'none',
  'pending',
  'processing',
  'partial',
  'full',
  'failed',
] as const;

export const PAYMENT_METHODS = [
  'cash',
  'card',
  'bank-transfer',
  'online',
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export type RefundStatus = (typeof REFUND_STATUSES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/**
 * Dining Enum Values
 */
export const DINING_TYPES = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'beverage',
  'dessert',
] as const;

export const MEAL_TYPES = [
  'vegetarian',
  'vegan',
  'gluten-free',
  'dairy-free',
  'nut-free',
  'regular',
] as const;

export const TABLE_PREFERENCES = [
  'window',
  'outdoor',
  'indoor',
  'private',
  'bar',
  'no-preference',
] as const;

export const DINING_RESERVATION_STATUSES = [
  'pending',
  'confirmed',
  'seated',
  'completed',
  'cancelled',
  'no-show',
] as const;

export type DiningType = (typeof DINING_TYPES)[number];
export type MealType = (typeof MEAL_TYPES)[number];
export type TablePreference = (typeof TABLE_PREFERENCES)[number];
export type DiningReservationStatus =
  (typeof DINING_RESERVATION_STATUSES)[number];

/**
 * Experience Enum Values
 */
export const EXPERIENCE_DIFFICULTIES = [
  'Easy',
  'Moderate',
  'Challenging',
] as const;

export const EXPERIENCE_BOOKING_STATUSES = [
  'pending',
  'confirmed',
  'completed',
  'cancelled',
] as const;

export type ExperienceDifficulty = (typeof EXPERIENCE_DIFFICULTIES)[number];
export type ExperienceBookingStatus =
  (typeof EXPERIENCE_BOOKING_STATUSES)[number];
