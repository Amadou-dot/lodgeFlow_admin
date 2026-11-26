import type { z } from 'zod';
import type {
  adminBookingJsonSchema,
  leanBookingJsonSchema,
  recentCustomerBookingJsonSchema,
} from '@/lib/validations/booking-json';

export type AdminBooking = z.output<typeof adminBookingJsonSchema>;
export type RecentCustomerBooking = z.output<
  typeof recentCustomerBookingJsonSchema
>;
export type BookingByEmail = z.output<typeof leanBookingJsonSchema>;
export type BookingCustomer = NonNullable<AdminBooking['customer']>;
export type BookingCabin = NonNullable<AdminBooking['cabin']>;
