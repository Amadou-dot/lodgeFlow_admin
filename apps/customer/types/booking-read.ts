import type {
  CabinSummary as BookingHistoryCabin,
  CabinDetail as BookingDetailCabin,
} from './cabin-read';
export type {
  CabinSummary as BookingHistoryCabin,
  CabinDetail as BookingDetailCabin,
} from './cabin-read';
import type {
  BOOKING_STATUSES,
  PAYMENT_METHODS,
  REFUND_STATUSES,
} from '@lodgeflow/database/config';

/** Verified legacy transport exception: reads retain persisted nulls and omission.
 * These DTOs describe the existing wire contract; serializers must not normalize it. */

export interface BookingReadFields {
  _id: string;
  __v?: number | null;
  customer: string;
  checkInDate: string;
  checkOutDate: string;
  numNights: number;
  numGuests: number;
  status: (typeof BOOKING_STATUSES)[number];
  cabinPrice: number;
  extrasPrice?: number;
  totalPrice: number;
  isPaid?: boolean;
  amountPaid?: number;
  payments?:
    | {
        id: string;
        amount: number;
        method: (typeof PAYMENT_METHODS)[number];
        receivedAt: string;
        paymentIntentId?: string | null;
        refundedAmount?: number | null;
      }[]
    | null;
  checkoutPending?: boolean;
  checkoutToken?: string | null;
  checkoutAmount?: number | null;
  checkoutTotalPrice?: number | null;
  checkoutCurrency?: string | null;
  paymentMethod?: (typeof PAYMENT_METHODS)[number] | null;
  extras?: {
    hasBreakfast: boolean;
    breakfastPrice: number;
    hasPets: boolean;
    petFee: number;
    hasParking: boolean;
    parkingFee: number;
    hasEarlyCheckIn: boolean;
    earlyCheckInFee: number;
    hasLateCheckOut: boolean;
    lateCheckOutFee: number;
  } | null;
  observations?: string | null;
  specialRequests?: string[];
  depositPaid?: boolean;
  depositAmount?: number;
  stripePaymentIntentId?: string | null;
  stripeSessionId?: string | null;
  paidAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  refundStatus?: (typeof REFUND_STATUSES)[number];
  refundAmount?: number | null;
  refundRequestedAmount?: number | null;
  cancellationRefunds?:
    | { paymentIntentId: string; amount: number; refundId?: string | null }[]
    | null;
  refundedAt?: string | null;
  paymentConfirmationSentAt?: string | null;
  remainingAmount?: number;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface BookingHistoryItem extends BookingReadFields {
  cabin: BookingHistoryCabin | null;
}

/** Existing payment-status JSON projection, including legacy null/omission semantics. */
export type BookingPaymentStatus = Pick<
  BookingReadFields,
  | 'isPaid'
  | 'depositPaid'
  | 'depositAmount'
  | 'totalPrice'
  | 'amountPaid'
  | 'remainingAmount'
  | 'paidAt'
  | 'stripeSessionId'
  | 'refundAmount'
  | 'refundedAt'
>;

export interface BookingDetail extends BookingReadFields {
  cabin: BookingDetailCabin | null;
  id: string;
  durationText?: string;
  paymentStatus?: 'paid' | 'partial' | 'unpaid';
}
