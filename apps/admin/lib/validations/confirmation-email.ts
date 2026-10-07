import { z } from 'zod';
import type { Cabin, PopulatedBooking } from '@/types';

const dateString = z
  .string()
  .refine(value => Number.isFinite(Date.parse(value)), 'Invalid booking date');
const amount = z.number().nonnegative();
const extras = z.object({
  hasBreakfast: z.boolean(),
  breakfastPrice: amount,
  hasPets: z.boolean(),
  petFee: amount,
  hasParking: z.boolean(),
  parkingFee: amount,
  hasEarlyCheckIn: z.boolean(),
  earlyCheckInFee: amount,
  hasLateCheckOut: z.boolean(),
  lateCheckOutFee: amount,
});
// This read-only email projection accepts the legacy full DTO, then selects
// only rendered fields. It never writes the supplied booking or cabin values.
export const confirmationEmailSchema = z.object({
  firstName: z.preprocess(value => (value == null ? '' : value), z.string()),
  email: z
    .string()
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address'),
  bookingData: z.object({
    _id: z.string().min(1),
    checkInDate: dateString,
    checkOutDate: dateString,
    numNights: z.number().int().nonnegative(),
    numGuests: z.number().int().positive(),
    cabinPrice: amount,
    extrasPrice: amount,
    totalPrice: amount,
    depositAmount: amount,
    remainingAmount: amount,
    extras: z.preprocess(
      value => (value == null ? undefined : value),
      extras.optional()
    ),
  }),
  cabinData: z.object({
    name: z.string(),
    capacity: z.number(),
    price: amount,
    description: z.string().optional().default(''),
    amenities: z.array(z.string()),
  }),
});
export type ConfirmationEmailInput = z.output<typeof confirmationEmailSchema>;
export interface ConfirmationEmailRequest {
  firstName: string;
  email: string;
  bookingData: Pick<
    PopulatedBooking,
    | '_id'
    | 'checkInDate'
    | 'checkOutDate'
    | 'numNights'
    | 'numGuests'
    | 'cabinPrice'
    | 'extrasPrice'
    | 'totalPrice'
    | 'depositAmount'
    | 'remainingAmount'
    | 'extras'
  >;
  cabinData: Pick<
    Cabin,
    'name' | 'capacity' | 'price' | 'description' | 'amenities'
  >;
}
