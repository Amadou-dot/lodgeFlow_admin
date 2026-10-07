import type { Customer } from './clerk';

export interface CustomerJson extends Omit<
  Customer,
  | 'created_at'
  | 'updated_at'
  | 'last_sign_in_at'
  | 'last_active_at'
  | 'lastBookingDate'
  | 'recentBookings'
> {
  created_at: string;
  updated_at: string;
  last_sign_in_at: string | null;
  last_active_at: string;
  lastBookingDate?: string;
  recentBookings?: (Omit<
    NonNullable<Customer['recentBookings']>[number],
    'checkInDate' | 'checkOutDate'
  > & {
    checkInDate: string;
    checkOutDate: string;
  })[];
}

export type GuestFormCustomer = Pick<
  CustomerJson,
  | 'id'
  | 'first_name'
  | 'last_name'
  | 'email'
  | 'phone'
  | 'nationality'
  | 'nationalId'
  | 'address'
  | 'emergencyContact'
  | 'preferences'
>;
