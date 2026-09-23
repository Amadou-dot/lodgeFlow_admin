import { Types } from 'mongoose';
import type { IBooking } from '@lodgeflow/database/models/Booking';
import type { PaymentEmailBooking } from '@/types/payment-email';

export function serializePaymentEmailBooking(
  booking: Pick<
    IBooking,
    | '_id'
    | 'customer'
    | 'checkInDate'
    | 'checkOutDate'
    | 'totalPrice'
    | 'remainingAmount'
  >
): PaymentEmailBooking {
  if (!(booking._id instanceof Types.ObjectId))
    throw new TypeError('Expected a MongoDB ObjectId');

  return {
    _id: booking._id.toHexString(),
    customer: booking.customer,
    checkInDate: booking.checkInDate.toISOString(),
    checkOutDate: booking.checkOutDate.toISOString(),
    totalPrice: booking.totalPrice,
    remainingAmount: booking.remainingAmount,
  };
}
