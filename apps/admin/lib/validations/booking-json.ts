import { CABIN_STATUSES } from '@lodgeflow/database/config';
import { bookingFields } from '@lodgeflow/database/reservation-read-fields';
import { z } from 'zod';
import {
  customerJsonSchema,
  jsonTimestampSchema as timestamp,
} from './customer-json';
import { bookingIdSchema } from './booking';

const text = z.string().min(1);
const sameId = (value: { id: string; _id: string }) => value.id === value._id;

// Customer history only populates the cabin summary. Richer projections may
// supply any of the other serialized cabin fields.
const cabinFields = z.object({
  _id: bookingIdSchema,
  name: text,
  image: text,
  capacity: z.number(),
  price: z.number(),
  images: z.array(z.string()).nullish(),
  amenities: z.array(z.string().nullable()).optional(),
  discount: z.number().nullish(),
  description: z.string().optional(),
  status: z.enum(CABIN_STATUSES).nullish(),
  bedrooms: z.number().nullish(),
  bathrooms: z.number().nullish(),
  size: z.number().nullish(),
  minNights: z.number().nullish(),
  extraGuestFee: z.number().nullish(),
  discountedPrice: z.number().nullish(),
  createdAt: timestamp.nullish(),
  updatedAt: timestamp.nullish(),
  __v: z.number().nullish(),
});
const bookingCabinJsonSchema = cabinFields
  .extend({ id: bookingIdSchema })
  .refine(sameId);

const recentBookingFields = bookingFields.extend({
  id: bookingIdSchema,
  cabin: bookingCabinJsonSchema.nullable(),
  durationText: z.string().optional(),
  paymentStatus: z.enum(['paid', 'partial', 'unpaid']).optional(),
});

export const recentCustomerBookingJsonSchema =
  recentBookingFields.refine(sameId);
const bookingCustomer = customerJsonSchema.partial().extend({
  id: text,
  name: z.string(),
  email: z.string(),
});
const populatedBooking = recentBookingFields.extend({
  guest: bookingCustomer.nullable(),
  customer: bookingCustomer.nullable(),
  cabinName: z.string().optional(),
});
export const adminBookingJsonSchema = populatedBooking.refine(sameId);
const collectionFields = populatedBooking.extend({
  guest: bookingCustomer,
  customer: bookingCustomer,
});
const collectionBooking = collectionFields.refine(sameId);
export const leanBookingJsonSchema = bookingFields.extend({
  cabin: cabinFields.extend({ description: text }).nullable(),
});

const success = z.object({
  success: z.literal(true),
  error: z.never().optional(),
  message: z.string().optional(),
});
const collectionSuccess = success.extend({
  _clerkWarning: z.string().optional(),
});
export const bookingListResponse = collectionSuccess.extend({
  data: z.array(collectionBooking),
  pagination: z.object({
    currentPage: z.number().int().positive(),
    totalPages: z.number().int().nonnegative(),
    totalBookings: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    hasNextPage: z.boolean(),
    hasPrevPage: z.boolean(),
  }),
});
export const bookingDetailResponse = success.extend({
  data: adminBookingJsonSchema,
});
export const bookingByEmailResponse = success.extend({
  data: leanBookingJsonSchema,
});
// Collection POST/PUT hooks historically also accept a complete standalone row.
export const bookingCollectionWriteResponse = z.union([
  collectionSuccess.extend({ data: collectionBooking }),
  collectionFields
    .extend({ success: z.never().optional(), error: z.never().optional() })
    .refine(sameId),
]);
export const bookingDeleteResponse = success.extend({
  message: z.literal('Booking deleted successfully'),
  data: z.never().optional(),
});
