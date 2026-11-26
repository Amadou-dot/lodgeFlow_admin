import {
  BOOKING_STATUSES,
  CABIN_STATUSES,
  PAYMENT_METHODS,
  REFUND_STATUSES,
} from '@lodgeflow/database/config';
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

const bookingPaymentJsonSchema = z.object({
  id: text,
  amount: z.number(),
  method: z.enum(PAYMENT_METHODS),
  receivedAt: timestamp,
  paymentIntentId: z.string().nullish(),
  refundedAmount: z.number().nullish(),
});

const bookingExtrasJsonSchema = z.object({
  hasBreakfast: z.boolean().nullish(),
  breakfastPrice: z.number().nullish(),
  hasPets: z.boolean().nullish(),
  petFee: z.number().nullish(),
  hasParking: z.boolean().nullish(),
  parkingFee: z.number().nullish(),
  hasEarlyCheckIn: z.boolean().nullish(),
  earlyCheckInFee: z.number().nullish(),
  hasLateCheckOut: z.boolean().nullish(),
  lateCheckOutFee: z.number().nullish(),
});

const bookingCancellationRefundJsonSchema = z.object({
  paymentIntentId: text,
  amount: z.number(),
  refundId: z.string().nullish(),
});

// Match the serialized booking read DTO and retain legacy nullable metadata
// and finite major-unit amounts without applying today's request limits.
const bookingFields = z.object({
  _id: bookingIdSchema,
  __v: z.number().nullish(),
  customer: text,
  checkInDate: timestamp,
  checkOutDate: timestamp,
  numNights: z.number(),
  numGuests: z.number(),
  status: z.enum(BOOKING_STATUSES).nullish(),
  cabinPrice: z.number(),
  extrasPrice: z.number().nullish(),
  totalPrice: z.number(),
  isPaid: z.boolean().nullish(),
  amountPaid: z.number().nullish(),
  payments: z.array(bookingPaymentJsonSchema).nullish(),
  checkoutPending: z.boolean().nullish(),
  checkoutToken: z.string().nullish(),
  checkoutAmount: z.number().nullish(),
  checkoutTotalPrice: z.number().nullish(),
  checkoutCurrency: z.string().nullish(),
  paymentMethod: z.enum(PAYMENT_METHODS).nullish(),
  extras: bookingExtrasJsonSchema.nullish(),
  observations: z.string().nullish(),
  specialRequests: z.array(z.string()).nullish(),
  depositPaid: z.boolean().nullish(),
  depositAmount: z.number().nullish(),
  stripePaymentIntentId: z.string().nullish(),
  stripeSessionId: z.string().nullish(),
  paidAt: timestamp.nullish(),
  cancelledAt: timestamp.nullish(),
  cancellationReason: z.string().nullish(),
  refundStatus: z.enum(REFUND_STATUSES).nullish(),
  refundAmount: z.number().nullish(),
  refundRequestedAmount: z.number().nullish(),
  cancellationRefunds: z.array(bookingCancellationRefundJsonSchema).nullish(),
  refundedAt: timestamp.nullish(),
  paymentConfirmationSentAt: timestamp.nullish(),
  remainingAmount: z.number().nullish(),
  checkInTime: timestamp.nullish(),
  checkOutTime: timestamp.nullish(),
  createdAt: timestamp.nullish(),
  updatedAt: timestamp.nullish(),
});
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
