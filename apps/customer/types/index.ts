import type {
  DiningReservationJson,
  DiningReservationDetail,
  ExperienceReservationJson,
  ExperienceReservationDetail,
} from '@lodgeflow/database/reservation-json';
import type { SettingsJson } from '@lodgeflow/database/settings-json';
import type { ExperienceJson } from '@lodgeflow/database/experience-json';
import type { DiningJson } from '@lodgeflow/database/dining-json';
import type { CabinDetail } from '@lodgeflow/database/cabin-json';
import { SVGProps } from 'react';

export type IconSvgProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

// Serializable application data shapes.
export type Cabin = CabinDetail;
export type Settings = SettingsJson;
export type Experience = ExperienceJson;
export type Dining = DiningJson;
export type ExperienceBooking = ExperienceReservationJson;
export type DiningReservation = DiningReservationJson;

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

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface AvailableCabin extends CabinDetail {
  isAvailable: boolean;
  conflictingBookings: string[];
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
export type PopulatedExperienceBooking = ExperienceReservationDetail;

export type { CreateExperienceBookingRequest as CreateExperienceBookingData } from '@/lib/validations/experience-booking';

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
export type PopulatedDiningReservation = DiningReservationDetail;

export type { CreateDiningReservationRequest as CreateDiningReservationData } from '@/lib/validations/dining-reservation';

// Zod-validated input types (preferred for new code)
export type {
  CreateBookingInput,
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

// Cancellation and refund JSON transport types.
export type {
  CancellationPolicy,
  RefundStatus,
  RefundType,
  RefundEstimate,
  CancellationDeadlines,
  RefundEstimateResponse,
  CancellationResponse,
} from './cancellation';
