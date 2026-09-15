/**
 * Application-wide configuration constants
 */

/**
 * SWR (Stale-While-Revalidate) Configuration
 */
export const SWR_CONFIG = {
  /** Default deduping interval for most data fetching (5 seconds) */
  DEDUPING_INTERVAL: 5000,

  /** Extended deduping interval for less frequently changing data (10 seconds) */
  DEDUPING_INTERVAL_LONG: 10000,

  /** Keep previous data while fetching new data */
  KEEP_PREVIOUS_DATA: true,

  /** Don't revalidate on window focus by default */
  REVALIDATE_ON_FOCUS: false,
} as const;

/**
 * MongoDB Configuration
 */
import { DB_CONFIG } from '@lodgeflow/database/config';
export { DB_CONFIG };

/**
 * Currency Configuration
 */
export const CURRENCY = {
  DEFAULT: 'USD',
  SYMBOL: '$',
} as const;

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

export const VALID_TRANSITIONS: Record<
  BookingStatus,
  readonly BookingStatus[]
> = {
  unconfirmed: ['confirmed', 'cancelled'],
  confirmed: ['checked-in', 'cancelled'],
  'checked-in': ['checked-out', 'cancelled'],
  'checked-out': [],
  cancelled: [],
} as const;

/**
 * Cabin/Dining/Experience Enum Values — single source of truth for Zod and Mongoose
 */
import { CABIN_STATUSES } from '@lodgeflow/database/config';
export { CABIN_STATUSES };

import { DINING_TYPES } from '@lodgeflow/database/config';
export { DINING_TYPES };

import { MEAL_TYPES } from '@lodgeflow/database/config';
export { MEAL_TYPES };

import { DINING_CATEGORIES } from '@lodgeflow/database/config';
export { DINING_CATEGORIES };

import { BEVERAGE_CATEGORIES } from '@lodgeflow/database/config';
export { BEVERAGE_CATEGORIES };

import { DIETARY_OPTIONS } from '@lodgeflow/database/config';
export { DIETARY_OPTIONS };

import { EXPERIENCE_DIFFICULTIES } from '@lodgeflow/database/config';
export { EXPERIENCE_DIFFICULTIES };

export type CabinStatus = (typeof CABIN_STATUSES)[number];
export type DiningType = (typeof DINING_TYPES)[number];
export type MealType = (typeof MEAL_TYPES)[number];
export type DiningCategory = (typeof DINING_CATEGORIES)[number];
export type BeverageCategory = (typeof BEVERAGE_CATEGORIES)[number];
export type DietaryOption = (typeof DIETARY_OPTIONS)[number];
export type ExperienceDifficulty = (typeof EXPERIENCE_DIFFICULTIES)[number];

/**
 * Loyalty Tier Thresholds
 */
export const LOYALTY_TIERS = {
  DIAMOND: { threshold: 10000, name: 'Diamond', color: 'secondary' },
  GOLD: { threshold: 5000, name: 'Gold', color: 'warning' },
  SILVER: { threshold: 2000, name: 'Silver', color: 'default' },
  BRONZE: { threshold: 0, name: 'Bronze', color: 'primary' },
} as const;
