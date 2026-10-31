import { addDays, startOfDay } from 'date-fns';
import type { ICabin } from './models/Cabin';
import type { ISettings } from './models/Settings';
import {
  calculateBookingPricing,
  calculateDepositAmount,
} from './booking-pricing';
import { paymentSummary, type BookingPayment } from './booking-payments';

/**
 * Reproducible demo stays relative to the seed date. Distribute bookings and
 * receipts over time rather than putting every future booking on one day.
 * Every cabin has its own sequential calendar, so stays cannot overlap.
 */
export function buildDemoBookings(
  cabins: ICabin[],
  settings: ISettings,
  customers: string[],
  today = new Date(),
  count = 500
) {
  const active = cabins.filter(c => c.status === 'active');
  if (!customers.length || !active.length) return [];

  const referenceDay = startOfDay(today);
  const nextDates = active.map((_, slot) =>
    addDays(referenceDay, -110 + (slot % 7))
  );

  return Array.from({ length: count }, (_, index) => {
    const slot = index % active.length;
    const cabin = active[slot];
    const numNights = Math.min(
      settings.maxBookingLength,
      Math.max(
        settings.minBookingLength,
        cabin.minNights ?? 1,
        2 + ((index * 7 + Math.floor(index / active.length)) % 6)
      )
    );
    if (numNights < (cabin.minNights ?? 1))
      throw new Error('Cabin minimum exceeds maximum stay');

    const checkInDate = nextDates[slot];
    const checkOutDate = addDays(checkInDate, numNights);
    nextDates[slot] = addDays(checkOutDate, index % 4 === 0 ? 2 : 1);

    const numGuests =
      1 + (index % Math.min(cabin.capacity, settings.maxGuestsPerBooking));
    const pricing = calculateBookingPricing({
      cabin,
      settings,
      checkInDate,
      checkOutDate,
      numGuests,
      extras: {
        hasBreakfast: index % 2 === 0,
        hasPets: settings.allowPets && index % 5 === 0,
        hasParking: index % 3 === 0,
        hasEarlyCheckIn: index % 9 === 0,
        hasLateCheckOut: index % 13 === 0,
      },
    });
    const depositAmount = calculateDepositAmount({
      settings,
      totalPrice: pricing.totalPrice,
    });

    const cancelled = index % 11 === 0;
    const past = checkOutDate <= today;
    const current = checkInDate <= today && !past;
    const amount = cancelled
      ? 0
      : past || current || index % 3 === 0
        ? pricing.totalPrice
        : index % 3 === 1
          ? depositAmount
          : 0;

    // Historic stays were booked before check-in. Upcoming stays are booked
    // throughout the last month, without any timestamps in the future.
    const desiredCreatedAt = addDays(checkInDate, -(4 + ((index * 11) % 24)));
    const createdAt =
      desiredCreatedAt > referenceDay
        ? addDays(referenceDay, -((index * 17) % 29))
        : desiredCreatedAt;

    const method: BookingPayment['method'] =
      index % 4 === 0 ? 'bank-transfer' : 'cash';
    const payments: BookingPayment[] =
      amount > 0
        ? [
            {
              id: `demo-${index}`,
              amount,
              method,
              receivedAt: createdAt,
            },
          ]
        : [];

    return {
      ...pricing,
      ...paymentSummary({
        totalPrice: pricing.totalPrice,
        depositAmount,
        payments,
      }),
      cabin: cabin._id,
      customer:
        customers[
          (index * 37 + Math.floor(index / active.length) * 11) %
            customers.length
        ],
      checkInDate,
      checkOutDate,
      numGuests,
      depositAmount,
      payments,
      paymentMethod: method,
      paidAt: amount ? createdAt : undefined,
      status: cancelled
        ? 'cancelled'
        : past
          ? 'checked-out'
          : current
            ? 'checked-in'
            : amount
              ? 'confirmed'
              : 'unconfirmed',
      cancelledAt: cancelled ? createdAt : undefined,
      checkInTime: !cancelled && (past || current) ? checkInDate : undefined,
      checkOutTime: !cancelled && past ? checkOutDate : undefined,
      specialRequests:
        index % 7 === 0
          ? ['Extra towels on arrival']
          : index % 9 === 0
            ? ['Quiet cabin preferred']
            : [],
      observations:
        'Demo reservation. All receipts are simulated offline payments; no payment provider was charged.',
      createdAt,
    };
  });
}
