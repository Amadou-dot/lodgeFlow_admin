import { differenceInCalendarDays } from 'date-fns';
import {
  majorAmount,
  MoneyError,
  roundMajorAmount,
  type MajorCurrencyAmount,
} from './money';

/**
 * Thrown when calculateBookingPricing() is given inputs that can't yield a
 * sane price (e.g. a non-positive stay length). Callers should catch this
 * distinctly and surface it as a 400 rather than a generic server error —
 * it signals bad input, not a server fault.
 */
export class BookingPricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BookingPricingError';
    // Restore the prototype chain — TS compiles `extends Error` down to
    // ES5 (tsconfig `target`), which otherwise breaks `instanceof` checks.
    Object.setPrototypeOf(this, BookingPricingError.prototype);
  }
}

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

export interface BookingDepositSettings {
  requireDeposit: boolean;
  depositPercentage: number;
}

export interface BookingDepositInput {
  settings: BookingDepositSettings;
  totalPrice: number;
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
  cabinPrice: MajorCurrencyAmount;
  extrasPrice: MajorCurrencyAmount;
  totalPrice: MajorCurrencyAmount;
  extras: {
    hasBreakfast: boolean;
    breakfastPrice: MajorCurrencyAmount;
    hasPets: boolean;
    petFee: MajorCurrencyAmount;
    hasParking: boolean;
    parkingFee: MajorCurrencyAmount;
    hasEarlyCheckIn: boolean;
    earlyCheckInFee: MajorCurrencyAmount;
    hasLateCheckOut: boolean;
    lateCheckOutFee: MajorCurrencyAmount;
  };
}

/** Adapts numeric catalog/settings/calculated prices without rounding storage. */
function priceAmount(value: number): MajorCurrencyAmount {
  try {
    return majorAmount(value, { precision: 'preserve' });
  } catch (error) {
    if (error instanceof MoneyError)
      throw new BookingPricingError(
        'Prices must be finite, nonnegative and within the safe cents range'
      );
    throw error;
  }
}

/**
 * Derives the deposit due on a *new* booking from the settings document,
 * never from client input (see issue #124 — a client-supplied depositAmount
 * equal to totalPrice would make a booking read as fully paid with no payment
 * recorded).
 *
 * Recompute on an unpaid booking when its quote changes. Received money lives
 * in receipt entries and never in depositAmount.
 */
export function calculateDepositAmount({
  settings,
  totalPrice,
}: BookingDepositInput): MajorCurrencyAmount {
  const total = priceAmount(totalPrice);
  if (!settings.requireDeposit) return priceAmount(0);

  if (!Number.isFinite(settings.depositPercentage))
    throw new BookingPricingError('Deposit percentage must be finite');
  let deposit: MajorCurrencyAmount;
  try {
    deposit = roundMajorAmount({
      amount: majorAmount(total * (settings.depositPercentage / 100), {
        precision: 'preserve',
        sign: 'signed',
      }),
      rounding: 'whole',
      maximum: total,
    });
  } catch (error) {
    if (error instanceof MoneyError)
      throw new BookingPricingError('Deposit exceeds the safe cents range');
    throw error;
  }
  // depositPercentage is schema-bound to 0-100, but clamp anyway so a legacy
  // or hand-edited settings document can never yield a deposit that exceeds
  // the total (which would drive remainingAmount negative).
  return priceAmount(Math.min(Math.max(deposit, 0), total));
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
  // NaN comparisons are always false, so an invalid date/guest count must be
  // rejected explicitly — otherwise it silently passes the `< 1` guard below
  // and propagates as a NaN price instead of a 400.
  if (!Number.isFinite(numNights) || numNights < 1) {
    throw new BookingPricingError(
      'checkOutDate must be at least one day after checkInDate'
    );
  }
  if (!Number.isFinite(numGuests) || numGuests < 1) {
    throw new BookingPricingError('numGuests must be at least 1');
  }

  const cabinPrice = priceAmount(
    cabin.discount > 0
      ? priceAmount(cabin.price) - priceAmount(cabin.discount)
      : priceAmount(cabin.price)
  );

  const hasBreakfast = extras?.hasBreakfast ?? false;
  const hasPets = extras?.hasPets ?? false;
  const hasParking = extras?.hasParking ?? false;
  const hasEarlyCheckIn = extras?.hasEarlyCheckIn ?? false;
  const hasLateCheckOut = extras?.hasLateCheckOut ?? false;

  const breakfastPrice = priceAmount(
    hasBreakfast
      ? priceAmount(settings.breakfastPrice) * numGuests * numNights
      : 0
  );

  const extraGuestFee = priceAmount(
    numGuests > 1 && (cabin.extraGuestFee ?? 0) > 0
      ? (numGuests - 1) * priceAmount(cabin.extraGuestFee ?? 0) * numNights
      : 0
  );

  const petFee = priceAmount(
    hasPets ? priceAmount(settings.petFee) * numNights : 0
  );

  const parkingFee = priceAmount(
    hasParking && !settings.parkingIncluded
      ? priceAmount(settings.parkingFee) * numNights
      : 0
  );

  const earlyCheckInFee = priceAmount(
    hasEarlyCheckIn ? settings.earlyCheckInFee : 0
  );
  const lateCheckOutFee = priceAmount(
    hasLateCheckOut ? settings.lateCheckOutFee : 0
  );

  const extrasPrice = priceAmount(
    breakfastPrice +
      extraGuestFee +
      petFee +
      parkingFee +
      earlyCheckInFee +
      lateCheckOutFee
  );

  const totalPrice = priceAmount(cabinPrice * numNights + extrasPrice);

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
