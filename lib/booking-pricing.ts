import { differenceInCalendarDays } from 'date-fns';

export interface BookingPricingCabin {
  price: number;
  discount: number;
  extraGuestFee?: number;
}

export interface BookingPricingSettings {
  breakfastPrice: number;
  petFee: number;
  parkingFee: number;
  parkingIncluded: boolean;
  earlyCheckInFee: number;
  lateCheckOutFee: number;
}

export interface BookingPricingExtrasSelection {
  hasBreakfast?: boolean;
  hasPets?: boolean;
  hasParking?: boolean;
  hasEarlyCheckIn?: boolean;
  hasLateCheckOut?: boolean;
}

export interface BookingPricingInput {
  cabin: BookingPricingCabin;
  settings: BookingPricingSettings;
  checkInDate: Date;
  checkOutDate: Date;
  numGuests: number;
  extras?: BookingPricingExtrasSelection;
}

export interface BookingPricingResult {
  numNights: number;
  cabinPrice: number;
  extrasPrice: number;
  totalPrice: number;
  extras: {
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
  };
}

/**
 * Recomputes every price-derived booking field from trusted server data
 * (the cabin and settings documents) instead of client input. Only the
 * boolean extras selections are taken from the caller — every fee amount
 * is looked up from `settings`/`cabin` so a tampered request body can't
 * influence the price actually charged.
 */
export function calculateBookingPricing({
  cabin,
  settings,
  checkInDate,
  checkOutDate,
  numGuests,
  extras,
}: BookingPricingInput): BookingPricingResult {
  const numNights = differenceInCalendarDays(checkOutDate, checkInDate);

  const cabinPrice =
    cabin.discount > 0 ? cabin.price - cabin.discount : cabin.price;

  const hasBreakfast = extras?.hasBreakfast ?? false;
  const hasPets = extras?.hasPets ?? false;
  const hasParking = extras?.hasParking ?? false;
  const hasEarlyCheckIn = extras?.hasEarlyCheckIn ?? false;
  const hasLateCheckOut = extras?.hasLateCheckOut ?? false;

  const breakfastPrice = hasBreakfast
    ? settings.breakfastPrice * numGuests * numNights
    : 0;

  const extraGuestFee =
    numGuests > 1 && (cabin.extraGuestFee ?? 0) > 0
      ? (numGuests - 1) * (cabin.extraGuestFee ?? 0) * numNights
      : 0;

  const petFee = hasPets ? settings.petFee * numNights : 0;

  const parkingFee =
    hasParking && !settings.parkingIncluded
      ? settings.parkingFee * numNights
      : 0;

  const earlyCheckInFee = hasEarlyCheckIn ? settings.earlyCheckInFee : 0;
  const lateCheckOutFee = hasLateCheckOut ? settings.lateCheckOutFee : 0;

  const extrasPrice =
    breakfastPrice +
    extraGuestFee +
    petFee +
    parkingFee +
    earlyCheckInFee +
    lateCheckOutFee;

  const totalPrice = cabinPrice * numNights + extrasPrice;

  return {
    numNights,
    cabinPrice,
    extrasPrice,
    totalPrice,
    extras: {
      hasBreakfast,
      breakfastPrice,
      hasPets,
      petFee,
      hasParking,
      parkingFee,
      hasEarlyCheckIn,
      earlyCheckInFee,
      hasLateCheckOut,
      lateCheckOutFee,
    },
  };
}
