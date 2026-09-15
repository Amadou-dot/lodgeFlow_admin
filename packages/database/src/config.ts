export const DB_CONFIG = {
  /** Maximum connection pool size */
  MAX_POOL_SIZE: 10,

  /** Server selection timeout in milliseconds */
  SERVER_SELECTION_TIMEOUT: 5000,

  /** Socket timeout in milliseconds */
  SOCKET_TIMEOUT: 45000,
} as const;

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

export const DINING_RESERVATION_STATUSES = [
  'pending',
  'confirmed',
  'seated',
  'completed',
  'cancelled',
  'no-show',
] as const;

export const EXPERIENCE_BOOKING_STATUSES = [
  'pending',
  'confirmed',
  'completed',
  'cancelled',
] as const;

export const TABLE_PREFERENCES = [
  'window',
  'outdoor',
  'indoor',
  'private',
  'bar',
  'no-preference',
] as const;

export const DINING_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled', 'no-show'],
  completed: [],
  cancelled: [],
  'no-show': [],
};
export const EXPERIENCE_STATUS_TRANSITIONS: Record<string, readonly string[]> =
  {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
  };
