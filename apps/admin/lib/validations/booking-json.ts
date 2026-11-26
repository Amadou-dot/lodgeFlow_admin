import {
  BOOKING_STATUSES,
  CABIN_STATUSES,
  PAYMENT_METHODS,
  REFUND_STATUSES,
} from '@lodgeflow/database/config';
import { z } from 'zod';
import type { BookingCabin, RecentCustomerBooking } from '@/types/booking-read';

const timestamp = z.iso.datetime();

// Customer history only populates the cabin summary. Richer projections may
// supply any of the other serialized cabin fields.
const bookingCabinJsonSchema = z.object({
  _id: z.string(),
  id: z.string(),
  name: z.string(),
  image: z.string(),
  capacity: z.number(),
  price: z.number(),
  images: z.array(z.string()).optional(),
  amenities: z.array(z.string()).optional(),
  discount: z.number().optional(),
  description: z.string().optional(),
  status: z.enum(CABIN_STATUSES).optional(),
  bedrooms: z.number().nullish(),
  bathrooms: z.number().nullish(),
  size: z.number().nullish(),
  minNights: z.number().nullish(),
  extraGuestFee: z.number().optional(),
  discountedPrice: z.number().nullish(),
  createdAt: timestamp.nullish(),
  updatedAt: timestamp.nullish(),
  __v: z.number().nullish(),
}) satisfies z.ZodType<BookingCabin>;

const bookingPaymentJsonSchema = z.object({
  id: z.string(),
  amount: z.number(),
  method: z.enum(PAYMENT_METHODS),
  receivedAt: timestamp,
  paymentIntentId: z.string().nullish(),
  refundedAmount: z.number().nullish(),
});

const bookingExtrasJsonSchema = z.object({
  hasBreakfast: z.boolean(),
  breakfastPrice: z.number(),
  hasPets: z.boolean(),
  petFee: z.number(),
  hasParking: z.boolean(),
  parkingFee: z.number(),
  hasEarlyCheckIn: z.boolean(),
  earlyCheckInFee: z.number(),
  hasLateCheckOut: z.boolean(),
  lateCheckOutFee: z.number(),
});

const bookingCancellationRefundJsonSchema = z.object({
  paymentIntentId: z.string(),
  amount: z.number(),
  refundId: z.string().nullish(),
});

// Match the serialized booking read DTO and retain legacy nullable metadata
// and finite major-unit amounts without applying today's request limits.
export const recentCustomerBookingJsonSchema = z.object({
  _id: z.string(),
  id: z.string(),
  __v: z.number().nullish(),
  customer: z.string(),
  cabin: bookingCabinJsonSchema.nullable(),
  checkInDate: timestamp,
  checkOutDate: timestamp,
  numNights: z.number(),
  numGuests: z.number(),
  status: z.enum(BOOKING_STATUSES),
  cabinPrice: z.number(),
  extrasPrice: z.number(),
  totalPrice: z.number(),
  isPaid: z.boolean(),
  amountPaid: z.number(),
  payments: z.array(bookingPaymentJsonSchema).nullish(),
  checkoutPending: z.boolean().optional(),
  checkoutToken: z.string().nullish(),
  checkoutAmount: z.number().nullish(),
  checkoutTotalPrice: z.number().nullish(),
  checkoutCurrency: z.string().nullish(),
  paymentMethod: z.enum(PAYMENT_METHODS).nullish(),
  extras: bookingExtrasJsonSchema.nullish(),
  observations: z.string().nullish(),
  specialRequests: z.array(z.string()).optional(),
  depositPaid: z.boolean(),
  depositAmount: z.number(),
  stripePaymentIntentId: z.string().nullish(),
  stripeSessionId: z.string().nullish(),
  paidAt: timestamp.nullish(),
  cancelledAt: timestamp.nullish(),
  cancellationReason: z.string().nullish(),
  refundStatus: z.enum(REFUND_STATUSES).optional(),
  refundAmount: z.number().nullish(),
  refundRequestedAmount: z.number().nullish(),
  cancellationRefunds: z.array(bookingCancellationRefundJsonSchema).nullish(),
  refundedAt: timestamp.nullish(),
  paymentConfirmationSentAt: timestamp.nullish(),
  remainingAmount: z.number(),
  checkInTime: timestamp.nullish(),
  checkOutTime: timestamp.nullish(),
  createdAt: timestamp.nullish(),
  updatedAt: timestamp.nullish(),
  durationText: z.string().optional(),
  paymentStatus: z.enum(['paid', 'partial', 'unpaid']).optional(),
}) satisfies z.ZodType<RecentCustomerBooking>;
