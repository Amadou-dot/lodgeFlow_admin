import type { IBooking } from '@/models/Booking';
import type { ICabin } from '@/models/Cabin';
import type { IDining } from '@/models/Dining';
import type { IExperience } from '@/models/Experience';
import type { ISettings } from '@/models/Settings';
import { SVGProps } from 'react';
import type {
  ClerkUser,
  ClerkUserListParams,
  Customer,
  CustomerPrivateMetadata,
  CustomerPublicMetadata,
} from './clerk';

export type IconSvgProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

export type IdParam = { params: Promise<{ id: string }> };

// Re-export model types for easier importing
export type Cabin = ICabin;
// Customer is now imported from clerk.ts instead of the model
export type {
  ClerkUser,
  ClerkUserListParams,
  Customer,
  CustomerPrivateMetadata,
  CustomerPublicMetadata,
};
export type Booking = IBooking;
export type Dining = IDining;
export type Settings = ISettings;
export type Experience = IExperience;

// Type for recent bookings from customer data
export interface RecentBooking {
  _id: string;
  cabin?: {
    name: string;
    image?: string;
    capacity?: number;
    price?: number;
  };
  checkInDate: string | Date;
  checkOutDate: string | Date;
  numNights: number;
  status:
    | 'unconfirmed'
    | 'confirmed'
    | 'checked-in'
    | 'checked-out'
    | 'cancelled';
  totalPrice: number;
  isPaid?: boolean;
}

// Extended types for populated models (used in API responses)
export interface PopulatedBooking extends Omit<
  IBooking,
  'cabin' | 'customer' | 'checkInDate' | 'checkOutDate'
> {
  cabin: ICabin;
  customer: Customer; // Updated to use new Customer type from Clerk
  checkInDate: string | Date; // API returns string, but might be Date in some contexts
  checkOutDate: string | Date; // API returns string, but might be Date in some contexts
  cabinName?: string; // For legacy compatibility
  guest?: Customer; // For legacy compatibility - updated to use new Customer type
}

// Legacy type aliases for backward compatibility
export type AppSettings = ISettings;

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

export interface CustomerWithStats extends Customer {
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
