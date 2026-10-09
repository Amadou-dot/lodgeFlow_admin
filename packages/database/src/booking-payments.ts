import type { IBooking } from './models/Booking';
import {
  majorAmount,
  MoneyError,
  roundMajorAmount,
  type MajorCurrencyAmount,
} from './money';

export interface BookingPayment {
  id: string;
  amount: number;
  method: 'cash' | 'card' | 'bank-transfer' | 'online';
  receivedAt: Date;
  paymentIntentId?: string;
  refundedAmount?: number;
}

export class BookingPaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BookingPaymentError';
    Object.setPrototypeOf(this, BookingPaymentError.prototype);
  }
}

/** Legacy cabin/reservation price rounding; never use as receipt validation. */
export function roundMoney(amount: number): MajorCurrencyAmount {
  return roundMajorAmount({
    amount: majorAmount(amount, { precision: 'preserve', sign: 'signed' }),
    rounding: 'epsilon',
  });
}

/** Required deposits are obligations. Only receipt entries count as received money. */
export function paymentSummary({
  totalPrice,
  depositAmount,
  payments,
}: {
  totalPrice: number;
  depositAmount: number;
  payments: readonly Readonly<Pick<BookingPayment, 'amount'>>[];
}) {
  // This is the persistence adapter; existing prices and receipt history retain
  // their precision. New receipts use exact validation in addBookingPayment.
  try {
    const total = majorAmount(totalPrice, { precision: 'preserve' });
    const deposit = majorAmount(depositAmount, { precision: 'preserve' });
    const amountPaid = roundMoney(
      payments.reduce(
        (sum, payment) =>
          sum + majorAmount(payment.amount, { precision: 'preserve' }),
        0
      )
    );
    return {
      amountPaid,
      remainingAmount: majorAmount(
        Math.max(0, roundMoney(total - amountPaid)),
        { precision: 'exact' }
      ),
      isPaid: amountPaid >= total,
      depositPaid: amountPaid > 0 && amountPaid >= deposit,
    };
  } catch (error) {
    if (error instanceof MoneyError)
      throw new BookingPaymentError(
        'Booking amounts must be finite, nonnegative and within the safe cents range'
      );
    throw error;
  }
}

/** Validates a new major-unit receipt without rounding the requested amount. */
export function parseBookingPaymentAmount(amount: number): MajorCurrencyAmount {
  try {
    return majorAmount(amount, { precision: 'exact', sign: 'positive' });
  } catch (error) {
    if (!(error instanceof MoneyError)) throw error;
    throw new BookingPaymentError(
      'Payment must be a positive amount with at most two decimal places'
    );
  }
}

/** Mutates a loaded document; callers persist with optimistic concurrency enabled. */
export function addBookingPayment(
  booking: Pick<
    IBooking,
    | 'status'
    | 'payments'
    | 'totalPrice'
    | 'depositAmount'
    | 'amountPaid'
    | 'remainingAmount'
    | 'isPaid'
    | 'depositPaid'
    | 'paymentMethod'
    | 'paidAt'
  >,
  payment: BookingPayment
): boolean {
  if (booking.status === 'cancelled')
    throw new BookingPaymentError(
      'Cannot record payment on a cancelled booking'
    );
  const existing = booking.payments.find(entry => entry.id === payment.id);
  if (existing) {
    if (
      existing.amount !== payment.amount ||
      existing.method !== payment.method
    ) {
      throw new BookingPaymentError(
        'Payment reference already exists with different details'
      );
    }
    return false;
  }
  const amount = parseBookingPaymentAmount(payment.amount);
  const summary = paymentSummary({
    totalPrice: booking.totalPrice,
    depositAmount: booking.depositAmount,
    payments: booking.payments,
  });
  if (amount > summary.remainingAmount) {
    throw new BookingPaymentError('Payment exceeds the outstanding balance');
  }
  booking.payments.push({ ...payment, amount });
  Object.assign(
    booking,
    paymentSummary({
      totalPrice: booking.totalPrice,
      depositAmount: booking.depositAmount,
      payments: booking.payments,
    })
  );
  booking.paymentMethod = payment.method;
  booking.paidAt = payment.receivedAt;
  return true;
}

export function assertBookingCanReprice(
  booking: Pick<IBooking, 'payments' | 'checkoutPending'>
): void {
  if (booking.checkoutPending || booking.payments.length > 0) {
    throw new BookingPaymentError(
      'Price changes are unavailable after payment or while checkout is active'
    );
  }
}

export interface CheckoutReceipt {
  bookingId: string;
  sessionId: string;
  quoteToken: string;
  amount: number;
  currency: string;
  paymentIntentId: string;
}
