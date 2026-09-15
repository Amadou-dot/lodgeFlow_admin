import type { IBooking } from './models/Booking';

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

export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/** Required deposits are obligations. Only receipt entries count as received money. */
export function paymentSummary(
  totalPrice: number,
  depositAmount: number,
  payments: BookingPayment[]
) {
  const amountPaid = roundMoney(
    payments.reduce((total, payment) => total + payment.amount, 0)
  );
  return {
    amountPaid,
    remainingAmount: Math.max(0, roundMoney(totalPrice - amountPaid)),
    isPaid: amountPaid >= totalPrice,
    depositPaid: amountPaid > 0 && amountPaid >= depositAmount,
  };
}

/** Mutates a loaded document; callers persist with optimistic concurrency enabled. */
export function addBookingPayment(
  booking: IBooking,
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
  if (
    !Number.isFinite(payment.amount) ||
    payment.amount <= 0 ||
    roundMoney(payment.amount) !== payment.amount
  ) {
    throw new BookingPaymentError(
      'Payment must be a positive amount with at most two decimal places'
    );
  }
  const summary = paymentSummary(
    booking.totalPrice,
    booking.depositAmount,
    booking.payments
  );
  if (payment.amount > summary.remainingAmount) {
    throw new BookingPaymentError('Payment exceeds the outstanding balance');
  }
  booking.payments.push(payment);
  Object.assign(
    booking,
    paymentSummary(booking.totalPrice, booking.depositAmount, booking.payments)
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
