import type { IBooking, IBookingModel } from '@/models/Booking';
import type { ICabin } from '@/models/Cabin';
import type { IDining } from '@/models/Dining';
import type { IDiningReservation } from '@/models/DiningReservation';
import type { IExperience } from '@/models/Experience';
import type { IExperienceBooking } from '@/models/ExperienceBooking';
import type { IProcessedStripeEvent } from '@/models/ProcessedStripeEvent';
import type { ISettings, ISettingsModel } from '@/models/Settings';
import { SVGProps } from 'react';

export type IconSvgProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

// Re-export model types for easier importing
export type Cabin = ICabin;
export type Booking = IBooking;
export type Settings = ISettings;
export type Experience = IExperience;
export type Dining = IDining;
export type ExperienceBooking = IExperienceBooking;
export type DiningReservation = IDiningReservation;

// Extended types for populated models (used in API responses)
export interface PopulatedBooking extends Omit<
  IBooking,
  'cabin' | 'customer' | 'checkInDate' | 'checkOutDate'
> {
  cabin: ICabin;
  customer: string; // Clerk user ID
  checkInDate: string | Date;
  checkOutDate: string | Date;
  cabinName?: string;
}

// API request types
export interface CreateCabinData {
  name: string;
  image: string;
  capacity: number;
  price: number;
  discount: number;
  description: string;
  amenities: string[];
  images?: string[];
  status?: 'active' | 'maintenance' | 'inactive';
  bedrooms?: number;
  bathrooms?: number;
  size?: number;
  minNights?: number;
  extraGuestFee?: number;
}

export interface UpdateCabinData extends Partial<CreateCabinData> {
  _id: string;
}

export interface CreateBookingData {
  cabinId: string;
  checkInDate: Date;
  checkOutDate: Date;
  numGuests: number;
  extras?: {
    hasBreakfast?: boolean;
    hasPets?: boolean;
    hasParking?: boolean;
    hasEarlyCheckIn?: boolean;
    hasLateCheckOut?: boolean;
  };
  specialRequests?: string[];
  observations?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Cabin availability check
export interface AvailabilityQuery {
  checkInDate: Date;
  checkOutDate: Date;
  guests: number;
}

export interface AvailableCabin extends ICabin {
  isAvailable: boolean;
  conflictingBookings?: string[];
}

// Cabin query parameters
export interface CabinsQueryParams {
  capacity?: number;
  minPrice?: number;
  maxPrice?: number;
  available?: boolean;
  search?: string;
  status?: 'active' | 'maintenance' | 'inactive';
}

// Experience-related types
export interface ExperienceQueryParams {
  category?: string;
  difficulty?: 'Easy' | 'Moderate' | 'Challenging';
  minPrice?: number;
  maxPrice?: number;
  isPopular?: boolean;
  tags?: string[];
}

export interface CreateExperienceData {
  name: string;
  price: number;
  duration: string;
  difficulty: 'Easy' | 'Moderate' | 'Challenging';
  category: string;
  description: string;
  longDescription?: string;
  image: string;
  gallery?: string[];
  includes: string[];
  available: string[];
  ctaText: string;
  isPopular?: boolean;
  maxParticipants?: number;
  minAge?: number;
  requirements?: string[];
  location?: string;
  highlights?: string[];
  whatToBring?: string[];
  cancellationPolicy?: string;
  seasonality?: string;
  tags?: string[];
  rating?: number;
  reviewCount?: number;
}

export interface UpdateExperienceData extends Partial<CreateExperienceData> {
  _id: string;
}

// Experience Booking types
export interface PopulatedExperienceBooking extends Omit<
  IExperienceBooking,
  'experience' | 'date'
> {
  experience: IExperience;
  date: string | Date;
}

export interface CreateExperienceBookingData {
  experienceId: string;
  date: Date;
  timeSlot?: string;
  numParticipants: number;
  specialRequests?: string[];
  observations?: string;
}

// Dining-related types
export interface DiningQueryParams {
  type?: 'menu' | 'experience';
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'all-day';
  category?: 'regular' | 'craft-beer' | 'wine' | 'spirits' | 'non-alcoholic';
  isPopular?: boolean;
  dietary?: string[];
  minPrice?: number;
  maxPrice?: number;
  search?: string;
}

// Dining Reservation types
export interface PopulatedDiningReservation extends Omit<
  IDiningReservation,
  'dining' | 'date'
> {
  dining: IDining;
  date: string | Date;
}

export interface CreateDiningReservationData {
  diningId: string;
  date: Date;
  time: string;
  numGuests: number;
  dietaryRequirements?: string[];
  specialRequests?: string[];
  tablePreference?: 'indoor' | 'outdoor' | 'bar' | 'no-preference';
  occasion?: string;
}

// Stripe event tracking
export type ProcessedStripeEvent = IProcessedStripeEvent;

// Model type re-exports
export type { IBookingModel } from '@/models/Booking';
export type { ISettingsModel } from '@/models/Settings';

// Zod-validated input types (preferred for new code)
export type {
  CreateBookingInput,
  PatchBookingInput,
  UpdateBookingDetailsInput,
} from '@/lib/validations/booking';
export type {
  CreateDiningReservationInput,
  PatchDiningReservationInput,
} from '@/lib/validations/dining-reservation';
export type {
  CreateExperienceBookingInput,
  PatchExperienceBookingInput,
} from '@/lib/validations/experience-booking';
export type {
  BookingQueryParams,
  CabinQueryParams as CabinFilters,
  DiningQueryParams as DiningFilters,
  DiningReservationQueryParams,
  ExperienceBookingQueryParams,
  ExperienceQueryParams as ExperienceFilters,
  PaginationParams,
} from '@/lib/validations/query-params';

// Cancellation and refund types
export type CancellationPolicy = 'flexible' | 'moderate' | 'strict';
export type RefundStatus =
  'none' | 'pending' | 'processing' | 'partial' | 'full' | 'failed';
export type RefundType = 'full' | 'partial' | 'none';

export interface RefundEstimate {
  refundPercentage: number;
  refundAmount: number;
  refundType: RefundType;
  reason: string;
  daysUntilCheckIn: number;
  policy: CancellationPolicy;
}

export interface CancellationDeadlines {
  fullRefundDeadline: Date | null;
  partialRefundDeadline: Date | null;
  partialRefundPercentage: number;
  policy: CancellationPolicy;
}

export interface RefundEstimateResponse {
  estimate: RefundEstimate;
  deadlines: CancellationDeadlines;
  policyDescription: string;
  canCancel: boolean;
  cancelNotAllowedReason?: string;
}

export interface CancellationResponse {
  booking: PopulatedBooking;
  refund: {
    amount: number;
    type: RefundType;
    status: RefundStatus;
    reason: string;
    error?: string;
  };
}
