import mongoose from 'mongoose';
import Booking from './models/Booking';
import {
  addBookingPayment,
  BookingPaymentError,
  type CheckoutReceipt,
} from './booking-payments';

/** Signed provider events may be delivered concurrently or retried in any order. */
export async function settleCheckoutPayment(receipt: CheckoutReceipt) {
  if (!receipt.paymentIntentId || !receipt.quoteToken)
    throw new BookingPaymentError(
      'Payment is missing its provider reference or quote'
    );
  for (let attempt = 0; attempt < 5; attempt++) {
    const booking = await Booking.findById(receipt.bookingId);
    if (!booking) return { booking: null, changed: false };
    const prior = booking.payments.find(p => p.id === receipt.sessionId);
    if (prior) {
      if (
        prior.amount !== receipt.amount ||
        prior.paymentIntentId !== receipt.paymentIntentId
      )
        throw new BookingPaymentError(
          'Payment receipt does not match previously recorded payment'
        );
      return { booking, changed: false };
    }
    if (
      !booking.checkoutPending ||
      booking.checkoutToken !== receipt.quoteToken ||
      booking.checkoutTotalPrice !== booking.totalPrice ||
      booking.checkoutAmount !== receipt.amount ||
      booking.checkoutCurrency !== receipt.currency
    ) {
      throw new BookingPaymentError(
        'Payment does not match the reserved booking quote'
      );
    }
    addBookingPayment(booking, {
      id: receipt.sessionId,
      amount: receipt.amount,
      method: 'online',
      receivedAt: new Date(),
      paymentIntentId: receipt.paymentIntentId,
    });
    booking.checkoutPending = false;
    booking.stripeSessionId = receipt.sessionId;
    booking.stripePaymentIntentId = receipt.paymentIntentId;
    if (booking.status === 'unconfirmed') booking.status = 'confirmed';
    try {
      await booking.save();
      return { booking, changed: true };
    } catch (error) {
      if (!(error instanceof mongoose.Error.VersionError) || attempt === 4)
        throw error;
    }
  }
  throw new BookingPaymentError('Booking changed; retry payment confirmation');
}
