import type { CustomerJson as Customer } from './customer-json';
import type { RecentCustomerBooking } from './booking-read';
import type { SettingsJson } from '@lodgeflow/database/settings-json';
import type { ExperienceJson } from '@lodgeflow/database/experience-json';
import type { DiningJson } from '@lodgeflow/database/dining-json';
import type { CabinDetail } from '@lodgeflow/database/cabin-json';
import { SVGProps } from 'react';
import type {
  ClerkUser,
  ClerkUserListParams,
  CustomerPrivateMetadata,
  CustomerPublicMetadata,
} from './clerk';

export type IconSvgProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

export type IdParam = { params: Promise<{ id: string }> };

// Serializable application data shapes.
export type Cabin = CabinDetail;
// Customer uses the JSON projection; server-side Clerk types remain explicit.
export type {
  ClerkUser,
  ClerkUserListParams,
  Customer,
  CustomerPrivateMetadata,
  CustomerPublicMetadata,
};
export type Dining = DiningJson;
export type Settings = SettingsJson;
export type Experience = ExperienceJson;

// Type for recent bookings from customer data
export type RecentBooking = RecentCustomerBooking;

export type { AdminBooking as PopulatedBooking } from './booking-read';

// Legacy type aliases for backward compatibility
export type AppSettings = SettingsJson;

// Additional types for API requests
export interface CreateCabinData {
  name: string;
  image: string;
  images?: string[];
  status?: 'active' | 'maintenance' | 'inactive';
  capacity: number;
  price: number;
  discount: number;
  description: string;
  amenities: string[];
  bedrooms?: number;
  bathrooms?: number;
  size?: number;
  minNights?: number;
  extraGuestFee?: number;
}

export interface UpdateCabinData extends Partial<CreateCabinData> {
  _id: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Base type for URL-storable filter values
type FilterValue = string | number | boolean | undefined;

export interface CabinFilters {
  [key: string]: FilterValue;
  filter?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  capacity?: 'small' | 'medium' | 'large';
  discount?: 'with' | 'without';
  status?: 'active' | 'maintenance' | 'inactive';
  search?: string;
}

export interface DiningFilters {
  [key: string]: FilterValue;
  type?: string;
  mealType?: string;
  category?: string;
  isAvailable?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface BookingsFilters {
  [key: string]: FilterValue;
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CustomersFilters {
  [key: string]: FilterValue;
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// API Response types for better type safety
export interface CustomersResponse {
  success: boolean;
  data: Customer[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCustomers: number; // Keep original field name from API
    limit: number; // Keep original field name from API
    hasNextPage: boolean;
    hasPrevPage: boolean; // Keep original field name from API
  };
}

export interface CustomerResponse {
  success: boolean;
  data: CustomerWithStats;
}

export interface CustomerWithStats extends Omit<Customer, 'recentBookings'> {
  // Additional calculated stats that aren't stored in the database
  completedBookings: number;
  totalRevenue: number;
  averageStayLength: number;
  recentBookings: RecentBooking[];
}

// Generic pagination interface for components
export interface PaginationData {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// Alias for customer pagination (same structure)
export type CustomerPaginationMeta = PaginationData;

export interface ExperienceFilters {
  [key: string]: FilterValue;
  search?: string;
  category?: string;
  difficulty?: 'Easy' | 'Moderate' | 'Challenging';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
