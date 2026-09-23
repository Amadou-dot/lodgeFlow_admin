import { Types } from 'mongoose';
import type { IBooking } from '@lodgeflow/database/models/Booking';
import type { ICabin } from '@lodgeflow/database/models/Cabin';
import type {
  BookingEmailBooking,
  BookingEmailCabin,
} from '@/types/booking-email';

export function serializeBookingEmailBooking(
  booking: Pick<
    IBooking,
    | '_id'
    | 'checkInDate'
    | 'checkOutDate'
    | 'numNights'
    | 'numGuests'
    | 'extrasPrice'
    | 'totalPrice'
    | 'depositAmount'
    | 'remainingAmount'
    | 'extras'
  >
): BookingEmailBooking {
  if (!(booking._id instanceof Types.ObjectId))
    throw new TypeError('Expected a MongoDB ObjectId');

  return {
    _id: booking._id.toHexString(),
    checkInDate: booking.checkInDate.toISOString(),
    checkOutDate: booking.checkOutDate.toISOString(),
    numNights: booking.numNights,
    numGuests: booking.numGuests,
    // The persisted cabinPrice is nightly; use the saved quote's stay subtotal.
    cabinSubtotal: booking.totalPrice - booking.extrasPrice,
    extrasPrice: booking.extrasPrice,
    totalPrice: booking.totalPrice,
    depositAmount: booking.depositAmount,
    remainingAmount: booking.remainingAmount,
    extras: {
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
  };
}

export function serializeBookingEmailCabin(
  cabin: Pick<
    ICabin,
    'name' | 'capacity' | 'price' | 'description' | 'amenities'
  >
): BookingEmailCabin {
  return {
    name: cabin.name,
    capacity: cabin.capacity,
    price: cabin.price,
    description: cabin.description,
    amenities: [...cabin.amenities],
  };
}
