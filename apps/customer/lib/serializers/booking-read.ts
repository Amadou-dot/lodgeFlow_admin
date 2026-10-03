import {
  serializeCabinSummary,
  serializeCabinDetail,
  type CabinSummarySource as HistoryCabinSource,
  type CabinDetailSource as DetailCabinSource,
} from '@lodgeflow/database/cabin-json';
export type {
  CabinSummarySource as HistoryCabinSource,
  CabinDetailSource as DetailCabinSource,
} from '@lodgeflow/database/cabin-json';
import { Types } from 'mongoose';
import type {
  BookingReadFields,
  BookingHistoryItem,
  BookingDetail,
  BookingPaymentStatus,
} from '@/types/booking-read';

type OptionalDateKey =
  | 'paidAt'
  | 'cancelledAt'
  | 'refundedAt'
  | 'paymentConfirmationSentAt'
  | 'checkInTime'
  | 'checkOutTime'
  | 'createdAt'
  | 'updatedAt';
type RequiredDateKey = 'checkInDate' | 'checkOutDate';

/** Selected persistence fields, independent of Mongoose document methods. */
export type BookingReadSource = Omit<
  BookingReadFields,
  '_id' | OptionalDateKey | RequiredDateKey | 'payments'
> & {
  _id: unknown;
  payments?:
    | (Omit<
        NonNullable<BookingReadFields['payments']>[number],
        'receivedAt'
      > & { receivedAt: Date })[]
    | null;
} & { [Key in RequiredDateKey]: Date } & {
  [Key in OptionalDateKey]?: Date | null;
};

function objectId(value: unknown): string {
  if (!(value instanceof Types.ObjectId))
    throw new TypeError('Expected a MongoDB ObjectId');
  return value.toHexString();
}

function optionalDate(value: Date | null | undefined) {
  return value == null ? value : value.toISOString();
}

export function serializeBookingPaymentStatus(
  booking: Pick<BookingReadSource, keyof BookingPaymentStatus>
): BookingPaymentStatus {
  return {
    isPaid: booking.isPaid,
    depositPaid: booking.depositPaid,
    depositAmount: booking.depositAmount,
    totalPrice: booking.totalPrice,
    amountPaid: booking.amountPaid,
    remainingAmount: booking.remainingAmount,
    paidAt: optionalDate(booking.paidAt),
    stripeSessionId: booking.stripeSessionId,
    refundAmount: booking.refundAmount,
    refundedAt: optionalDate(booking.refundedAt),
  };
}

function bookingFields(booking: BookingReadSource): BookingReadFields {
  return {
    _id: objectId(booking._id),
    __v: booking.__v,
    customer: booking.customer,
    checkInDate: booking.checkInDate.toISOString(),
    checkOutDate: booking.checkOutDate.toISOString(),
    numNights: booking.numNights,
    numGuests: booking.numGuests,
    status: booking.status,
    cabinPrice: booking.cabinPrice,
    extrasPrice: booking.extrasPrice,
    totalPrice: booking.totalPrice,
    isPaid: booking.isPaid,
    amountPaid: booking.amountPaid,
    payments:
      booking.payments == null
        ? booking.payments
        : booking.payments.map(payment => ({
            id: payment.id,
            amount: payment.amount,
            method: payment.method,
            receivedAt: payment.receivedAt.toISOString(),
            paymentIntentId: payment.paymentIntentId,
            refundedAmount: payment.refundedAmount,
          })),
    checkoutPending: booking.checkoutPending,
    checkoutToken: booking.checkoutToken,
    checkoutAmount: booking.checkoutAmount,
    checkoutTotalPrice: booking.checkoutTotalPrice,
    checkoutCurrency: booking.checkoutCurrency,
    paymentMethod: booking.paymentMethod,
    extras:
      booking.extras == null
        ? booking.extras
        : {
            hasBreakfast: booking.extras.hasBreakfast,
            breakfastPrice: booking.extras.breakfastPrice,
            hasPets: booking.extras.hasPets,
            petFee: booking.extras.petFee,
            hasParking: booking.extras.hasParking,
            parkingFee: booking.extras.parkingFee,
            hasEarlyCheckIn: booking.extras.hasEarlyCheckIn,
            earlyCheckInFee: booking.extras.earlyCheckInFee,
            hasLateCheckOut: booking.extras.hasLateCheckOut,
            lateCheckOutFee: booking.extras.lateCheckOutFee,
          },
    observations: booking.observations,
    specialRequests: booking.specialRequests,
    depositPaid: booking.depositPaid,
    depositAmount: booking.depositAmount,
    stripePaymentIntentId: booking.stripePaymentIntentId,
    stripeSessionId: booking.stripeSessionId,
    paidAt: optionalDate(booking.paidAt),
    cancelledAt: optionalDate(booking.cancelledAt),
    cancellationReason: booking.cancellationReason,
    refundStatus: booking.refundStatus,
    refundAmount: booking.refundAmount,
    refundRequestedAmount: booking.refundRequestedAmount,
    cancellationRefunds:
      booking.cancellationRefunds == null
        ? booking.cancellationRefunds
        : booking.cancellationRefunds.map(refund => ({
            paymentIntentId: refund.paymentIntentId,
            amount: refund.amount,
            refundId: refund.refundId,
          })),
    refundedAt: optionalDate(booking.refundedAt),
    paymentConfirmationSentAt: optionalDate(booking.paymentConfirmationSentAt),
    remainingAmount: booking.remainingAmount,
    checkInTime: optionalDate(booking.checkInTime),
    checkOutTime: optionalDate(booking.checkOutTime),
    createdAt: optionalDate(booking.createdAt),
    updatedAt: optionalDate(booking.updatedAt),
  };
}

export function serializeBookingHistory(
  booking: BookingReadSource & { cabin: HistoryCabinSource | null }
): BookingHistoryItem {
  return {
    ...bookingFields(booking),
    cabin: booking.cabin === null ? null : serializeCabinSummary(booking.cabin),
  };
}

export function serializeBookingDetail(
  booking: BookingReadSource & {
    cabin: DetailCabinSource | null;
    durationText?: string;
    paymentStatus?: 'paid' | 'partial' | 'unpaid';
  }
): BookingDetail {
  const cabin = booking.cabin;
  return {
    ...bookingFields(booking),
    id: objectId(booking._id),
    durationText: booking.durationText,
    paymentStatus: booking.paymentStatus,
    cabin: cabin === null ? null : serializeCabinDetail(cabin),
  };
}
