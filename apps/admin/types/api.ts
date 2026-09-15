import type { FilterQuery, SortOrder } from 'mongoose';
import type { IBooking } from '@/models/Booking';
import type { ICabin } from '@/models/Cabin';
import type { IDining } from '@/models/Dining';

// ============================================================================
// API Input Types (re-exported from Zod validation schemas — single source of truth)
// ============================================================================

export type {
  CreateBookingInput,
  UpdateBookingInput,
  PatchBookingInput,
} from '@/lib/validations/booking';

// ============================================================================
// MongoDB Query Filter Types
// ============================================================================

/**
 * Query filter for Cabin collection
 */
export type CabinQueryFilter = FilterQuery<ICabin>;

/**
 * Query filter for Booking collection
 */
export type BookingQueryFilter = FilterQuery<IBooking>;

/**
 * Query filter for Dining collection
 */
export type DiningQueryFilter = FilterQuery<IDining>;

// ============================================================================
// MongoDB Sort Types
// ============================================================================

/**
 * Generic MongoDB sort order type
 * Keys are field names, values are 1 (ascending) or -1 (descending)
 */
export type MongoSortOrder = Record<string, SortOrder>;

// ============================================================================
// Dashboard Aggregation Result Types
// ============================================================================

/**
 * Result from occupancy aggregation pipeline
 */
export interface OccupancyDataItem {
  _id: string;
  totalGuests: number;
  totalCapacity: number;
}

/**
 * Result from revenue aggregation pipeline
 */
export interface RevenueDataItem {
  _id: {
    week: number;
    year: number;
  };
  totalRevenue: number;
  bookingCount: number;
}

/**
 * Result from duration distribution aggregation pipeline
 */
export interface DurationDataItem {
  _id: string;
  count: number;
}

/**
 * Booking populated for dashboard recent activity
 */
export interface RecentBookingPopulated {
  _id: string;
  customer: string;
  cabin: {
    _id: string;
    name: string;
  } | null;
  checkInDate: Date;
  checkOutDate: Date;
  totalPrice: number;
  status: IBooking['status'];
  createdAt: Date;
}
