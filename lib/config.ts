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
export const DB_CONFIG = {
  /** Maximum connection pool size */
  MAX_POOL_SIZE: 10,

  /** Server selection timeout in milliseconds */
  SERVER_SELECTION_TIMEOUT: 5000,

  /** Socket timeout in milliseconds */
  SOCKET_TIMEOUT: 45000,
} as const;

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
export const CABIN_STATUSES = ['active', 'maintenance', 'inactive'] as const;

export const DINING_TYPES = ['menu', 'experience'] as const;

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'all-day'] as const;

export const DINING_CATEGORIES = [
  'regular',
  'craft-beer',
  'wine',
  'spirits',
  'non-alcoholic',
] as const;

export const BEVERAGE_CATEGORIES = [
  'craft-beer',
  'wine',
  'spirits',
  'non-alcoholic',
] as const;

export const DIETARY_OPTIONS = [
  'vegetarian',
  'vegan',
  'gluten-free',
  'dairy-free',
  'keto',
  'paleo',
] as const;

export const EXPERIENCE_DIFFICULTIES = [
  'Easy',
  'Moderate',
  'Challenging',
] as const;

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
