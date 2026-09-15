import mongoose from 'mongoose';
import Booking from './models/Booking';
import Cabin, { type ICabin } from './models/Cabin';
import Settings from './models/Settings';
import {
  calculateBookingPricing,
  calculateDepositAmount,
  type BookingPricingExtrasSelection,
} from './booking-pricing';
import { assertBookingCanReprice } from './booking-payments';
import { withCabinBookingLock } from './cabin-booking-lock';

/** Complete hydrated cabin populated by customer booking mutations. */
export type CustomerBookingCabin = ICabin & { _id: mongoose.Types.ObjectId };

export class BookingRuleError extends Error {
  constructor(
    message: string,
    public status: number = 400
  ) {
    super(message);
    this.name = 'BookingRuleError';
    Object.setPrototypeOf(this, BookingRuleError.prototype);
  }
}
interface BookingSelection {
  cabinId: string;
  customerId: string;
  checkInDate: Date;
  checkOutDate: Date;
  numGuests: number;
  extras?: BookingPricingExtrasSelection;
  specialRequests?: string[];
  observations?: string;
}

async function priceSelection(input: BookingSelection) {
  if (!mongoose.isValidObjectId(input.cabinId))
    throw new BookingRuleError('Invalid cabin ID');
  const [cabin, settings] = await Promise.all([
    Cabin.findById(input.cabinId),
    Settings.getSettings(),
  ]);
  if (!cabin) throw new BookingRuleError('Cabin not found', 404);
  if (cabin.status !== 'active')
    throw new BookingRuleError('Cabin is not available for booking');
  if (input.numGuests > Math.min(cabin.capacity, settings.maxGuestsPerBooking))
    throw new BookingRuleError('Cabin capacity exceeded');
  if (input.extras?.hasPets && !settings.allowPets)
    throw new BookingRuleError('Pets are not allowed');
  const pricing = calculateBookingPricing({ ...input, cabin, settings });
  const minimum = Math.max(settings.minBookingLength, cabin.minNights ?? 0);
  if (
    pricing.numNights < minimum ||
    pricing.numNights > settings.maxBookingLength
  )
    throw new BookingRuleError(
      `Booking length must be between ${minimum} and ${settings.maxBookingLength} nights`
    );
  return { pricing, settings };
}

export async function createCustomerBooking(input: BookingSelection) {
  const { pricing, settings } = await priceSelection(input);
  return withCabinBookingLock(input.cabinId, async () => {
    if (
      (
        await Booking.findOverlapping(
          input.cabinId,
          input.checkInDate,
          input.checkOutDate
        )
      ).length
    ) {
      throw new BookingRuleError(
        'Cabin is not available for the selected dates',
        409
      );
    }
    const booking = await Booking.create({
      ...pricing,
      cabin: input.cabinId,
      customer: input.customerId,
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
      numGuests: input.numGuests,
      status: 'unconfirmed',
      paymentMethod: 'online',
      payments: [],
      depositAmount: calculateDepositAmount({
        settings,
        totalPrice: pricing.totalPrice,
      }),
      specialRequests: input.specialRequests,
      observations: input.observations,
    });
    return booking.populate<{ cabin: CustomerBookingCabin | null }>('cabin');
  });
}

export async function updateCustomerBooking(
  id: string,
  customerId: string,
  updates: {
    numGuests?: number;
    extras?: BookingPricingExtrasSelection;
    specialRequests?: string[];
  }
) {
  if (!mongoose.isValidObjectId(id))
    throw new BookingRuleError('Booking not found', 404);
  const booking = await Booking.findOne({ _id: id, customer: customerId });
  if (!booking) throw new BookingRuleError('Booking not found', 404);
  if (!['unconfirmed', 'confirmed'].includes(booking.status))
    throw new BookingRuleError('This booking can no longer be modified');
  const guestChange =
    updates.numGuests !== undefined && updates.numGuests !== booking.numGuests;
  const extrasChange =
    updates.extras !== undefined &&
    Object.entries(updates.extras).some(
      ([key, value]) =>
        value !== undefined &&
        booking.extras[key as keyof BookingPricingExtrasSelection] !== value
    );
  if (guestChange || extrasChange) {
    assertBookingCanReprice(booking);
    const selection = {
      cabinId: String(booking.cabin),
      customerId,
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      numGuests: updates.numGuests ?? booking.numGuests,
      extras: { ...booking.extras, ...updates.extras },
    };
    const { pricing, settings } = await priceSelection(selection);
    Object.assign(booking, pricing, {
      numGuests: selection.numGuests,
      depositAmount: calculateDepositAmount({
        settings,
        totalPrice: pricing.totalPrice,
      }),
    });
  }
  if (updates.specialRequests !== undefined)
    booking.specialRequests = updates.specialRequests;
  await booking.save();
  return booking.populate<{ cabin: CustomerBookingCabin | null }>('cabin');
}
