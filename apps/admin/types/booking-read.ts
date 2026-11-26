import type { BookingReadFields } from '@lodgeflow/database/booking-json';
import type { CabinDetail } from '@lodgeflow/database/cabin-json';
import type { CustomerJson } from './customer-json';

/** List lookups retain their existing minimal fallback; detail lookups may be null. */
export type BookingCustomer = Pick<CustomerJson, 'id' | 'name' | 'email'> &
  Partial<CustomerJson>;
export type BookingCabin = Pick<
  CabinDetail,
  '_id' | 'id' | 'name' | 'image' | 'capacity' | 'price'
> &
  Partial<Omit<CabinDetail, 'discountedPrice'>> & {
    // Projections without discount serialize the computed price as null.
    discountedPrice?: number | null;
  };

export interface AdminBooking extends Omit<BookingReadFields, 'customer'> {
  id: string;
  extrasPrice: number;
  isPaid: boolean;
  amountPaid: number;
  depositPaid: boolean;
  depositAmount: number;
  remainingAmount: number;
  customer: BookingCustomer | null;
  guest: BookingCustomer | null;
  cabin: BookingCabin | null;
  cabinName?: string;
  durationText?: string;
  paymentStatus?: 'paid' | 'partial' | 'unpaid';
}

export type RecentCustomerBooking = Omit<
  AdminBooking,
  'customer' | 'guest' | 'cabinName'
> & { customer: string };
