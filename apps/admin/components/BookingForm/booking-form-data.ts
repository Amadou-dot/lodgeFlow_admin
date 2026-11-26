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
      specialRequests:
        booking.specialRequests?.filter(request => request !== null) ?? [],
      paymentMethod: booking.paymentMethod || '',
      isPaid: booking.isPaid === true,
      depositPaid: booking.depositPaid === true,
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

const extraChoices = [
  'hasBreakfast',
  'hasPets',
  'hasParking',
  'hasEarlyCheckIn',
  'hasLateCheckOut',
] as const;

type BookingDraftComparison = {
  formData: BookingFormData;
  initial: BookingFormData;
};

function stayChanged({ formData, initial }: BookingDraftComparison) {
  return (
    formData.checkInDate !== initial.checkInDate ||
    formData.checkOutDate !== initial.checkOutDate
  );
}

export function pricingInputsChanged(draft: BookingDraftComparison) {
  const { formData, initial } = draft;
  return (
    stayChanged(draft) ||
    formData.cabin !== initial.cabin ||
    formData.numGuests !== initial.numGuests ||
    extraChoices.some(field => formData[field] !== initial[field])
  );
}

export function buildBookingUpdateInput({
  booking,
  formData,
  initial,
}: BookingDraftComparison & { booking: AdminBooking }): UpdateBookingInput {
  const update: UpdateBookingInput = { _id: booking._id };
  if (stayChanged({ formData, initial }))
    Object.assign(update, stayDates(formData));
  if (formData.cabin !== initial.cabin) update.cabin = formData.cabin;
  // The saved selection follows detail refreshes; only an explicit replacement differs.
  if (formData.customer !== booking.customer?.id)
    update.customer = formData.customer;
  if (formData.numGuests !== initial.numGuests)
    update.numGuests = formData.numGuests;
  if (
    formData.paymentMethod &&
    formData.paymentMethod !== initial.paymentMethod
  )
    update.paymentMethod = formData.paymentMethod;
  if (formData.observations !== initial.observations)
    update.observations = formData.observations;
  if (
    formData.specialRequests.length !== initial.specialRequests.length ||
    formData.specialRequests.some(
      (request, index) => request !== initial.specialRequests[index]
    )
  )
    update.specialRequests = formData.specialRequests;
  if (extraChoices.some(field => formData[field] !== initial[field])) {
    // The PUT schema defaults missing choices to false, so merge unedited flags
    // from the most recent detail when any one choice needs to be written.
    const extras = bookingValues(formData).extras;
    for (const field of extraChoices) {
      if (formData[field] === initial[field])
        extras[field] = booking.extras?.[field] ?? false;
    }
    update.extras = extras;
  }
  return update;
}
