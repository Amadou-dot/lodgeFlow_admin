import { z } from 'zod';
import {
  BOOKING_STATUSES,
  PAYMENT_METHODS,
  REFUND_STATUSES,
  TABLE_PREFERENCES,
  DINING_RESERVATION_STATUSES,
  EXPERIENCE_BOOKING_STATUSES,
} from './config';

export const objectId = z.string().regex(/^[a-f0-9]{24}$/i);
const text = z.string().min(1);
export const timestamp = z.iso.datetime().or(
  z.string().refine(value => {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) && date.toISOString() === value;
  })
);
const textList = z.array(z.string().nullable()).nullish();
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
export const bookingFields = z.object({
  _id: objectId,
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
  specialRequests: z.array(z.string().nullable()).nullish(),
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
export const receipt = z.object({
  id: z.string().min(1),
  type: z.enum(['payment', 'refund']),
  amountCents: z.number(),
  method: z.enum(['cash', 'bank_transfer', 'card', 'stripe']),
  reference: z.string().nullish(),
  actor: z.string().min(1),
  recordedAt: timestamp,
});
// These fields come from stored records. Callers returning computed summaries
// apply their additional accounting constraints at that boundary.
export const checkout = z.object({
  token: z.string().nullish(),
  amountCents: z.number().nullish(),
  currency: z.string().nullish(),
  createdAt: timestamp.nullish(),
  sessionId: z.string().nullish(),
  pending: z.boolean().nullish(),
});
export const stripeRefund = z.object({
  token: z.string().nullish(),
  amountCents: z.number().nullish(),
  createdAt: timestamp.nullish(),
  refundId: z.string().nullish(),
  status: z.enum(['pending', 'succeeded', 'failed']).nullish(),
  actor: z.string().nullish(),
  reference: z.string().nullish(),
});
const common = z.object({
  _id: objectId,
  id: objectId.optional(),
  __v: z.number().nullish(),
  customer: z.string().min(1),
  date: timestamp,
  createdAt: timestamp.nullish(),
  updatedAt: timestamp.nullish(),
  totalPrice: z.number(),
  isPaid: z.boolean().nullable(),
  stripePaymentIntentId: z.string().nullish(),
  specialRequests: textList,
  receipts: z.array(receipt).nullish(),
  paymentConfirmationSentAt: timestamp.nullish(),
  checkout: checkout.nullish(),
  stripeRefund: stripeRefund.nullish(),
});
export const diningStatus = z.enum(DINING_RESERVATION_STATUSES);
export const experienceStatus = z.enum(EXPERIENCE_BOOKING_STATUSES);
export const dining = common.extend({
  time: z.string(),
  numGuests: z.number(),
  status: diningStatus.nullable(),
  dietaryRequirements: textList,
  tablePreference: z.enum(TABLE_PREFERENCES).nullish(),
  occasion: z.string().nullish(),
});
export const experience = common.extend({
  timeSlot: z.string().nullish(),
  numParticipants: z.number(),
  status: experienceStatus.nullable(),
  observations: z.string().nullish(),
});
