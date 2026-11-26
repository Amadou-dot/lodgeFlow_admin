import type { CreateBookingInput, UpdateBookingInput } from '@/types/api';
import type { AdminBooking } from '@/types/booking-read';
import type { BookingFormData } from './types';

type BookingStay = Pick<BookingFormData, 'checkInDate' | 'checkOutDate'>;

export const initializeBookingForm = (
  booking?: AdminBooking
): BookingFormData => {
  if (booking) {
    return {
      cabin: booking.cabin?._id ?? '',
      customer: booking.customer?.id ?? '',
      checkInDate: booking.checkInDate.split('T')[0],
      checkOutDate: booking.checkOutDate.split('T')[0],
      numGuests: booking.numGuests,
      hasBreakfast: booking.extras?.hasBreakfast || false,
      hasPets: booking.extras?.hasPets || false,
      hasParking: booking.extras?.hasParking || false,
      hasEarlyCheckIn: booking.extras?.hasEarlyCheckIn || false,
      hasLateCheckOut: booking.extras?.hasLateCheckOut || false,
      observations: booking.observations || '',
      specialRequests: booking.specialRequests || [],
      paymentMethod: booking.paymentMethod || '',
      isPaid: booking.isPaid,
      depositPaid: booking.depositPaid,
    };
  }

  return {
    cabin: '',
    customer: '',
    checkInDate: '',
    checkOutDate: '',
    numGuests: 1,
    hasBreakfast: false,
    hasPets: false,
    hasParking: false,
    hasEarlyCheckIn: false,
    hasLateCheckOut: false,
    observations: '',
    specialRequests: [],
    paymentMethod: '',
    isPaid: false,
    depositPaid: false,
  };
};

function bookingValues(formData: BookingFormData) {
  return {
    cabin: formData.cabin,
    customer: formData.customer,
    numGuests: formData.numGuests,
    paymentMethod: formData.paymentMethod || undefined,
    extras: {
      hasBreakfast: formData.hasBreakfast,
      hasPets: formData.hasPets,
      hasParking: formData.hasParking,
      hasEarlyCheckIn: formData.hasEarlyCheckIn,
      hasLateCheckOut: formData.hasLateCheckOut,
    },
    observations: formData.observations || undefined,
    specialRequests: formData.specialRequests,
  };
}

function stayDates(formData: BookingStay) {
  return {
    checkInDate: new Date(formData.checkInDate).toISOString(),
    checkOutDate: new Date(formData.checkOutDate).toISOString(),
  };
}

export function buildBookingCreateInput(
  formData: BookingFormData
): CreateBookingInput {
  return {
    ...bookingValues(formData),
    ...stayDates(formData),
    status: 'unconfirmed',
  };
}

export function buildBookingUpdateInput({
  booking,
  formData,
  initialStay,
}: {
  booking: Pick<AdminBooking, '_id' | 'status'>;
  formData: BookingFormData;
  initialStay: BookingStay;
}): UpdateBookingInput {
  // The date picker holds calendar days. Omitting the untouched pair preserves
  // stored timestamps, including stays that were saved with non-midnight times.
  const stayChanged =
    formData.checkInDate !== initialStay.checkInDate ||
    formData.checkOutDate !== initialStay.checkOutDate;
  return {
    _id: booking._id,
    status: booking.status,
    ...bookingValues(formData),
    ...(stayChanged ? stayDates(formData) : {}),
  };
}
