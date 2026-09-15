import { addDays, startOfDay } from 'date-fns';
import type { ICabin } from './models/Cabin';
import type { ISettings } from './models/Settings';
import {
  calculateBookingPricing,
  calculateDepositAmount,
} from './booking-pricing';
import { paymentSummary, type BookingPayment } from './booking-payments';

/** Deterministic, non-overlapping stays. Demo receipts are explicitly offline. */
export function buildDemoBookings(
  cabins: ICabin[],
  settings: ISettings,
  customers: string[],
  today = new Date(),
  count = 500
) {
  const active = cabins.filter(c => c.status === 'active');
  if (!customers.length || !active.length) return [];
  const nextDates = active.map(() => addDays(startOfDay(today), -90));
  return Array.from({ length: count }, (_, index) => {
    const slot = index % active.length;
    const cabin = active[slot];
    const numNights = Math.min(
      settings.maxBookingLength,
      Math.max(settings.minBookingLength, cabin.minNights ?? 1, 2 + (index % 4))
    );
    if (numNights < (cabin.minNights ?? 1))
      throw new Error('Cabin minimum exceeds maximum stay');
    const checkInDate = nextDates[slot];
    const checkOutDate = addDays(checkInDate, numNights);
    nextDates[slot] = addDays(checkOutDate, 1);
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
    const createdAt = addDays(checkInDate < today ? checkInDate : today, -7);
    const payments: BookingPayment[] =
      amount > 0
        ? [
            {
              id: `demo-${index}`,
              amount,
              method: 'cash',
              receivedAt: createdAt,
            },
          ]
        : [];
    return {
      ...pricing,
      ...paymentSummary(pricing.totalPrice, depositAmount, payments),
      cabin: cabin._id,
      customer: customers[index % customers.length],
      checkInDate,
      checkOutDate,
      numGuests,
      depositAmount,
      payments,
      paymentMethod: 'cash',
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
      observations:
        'Demo reservation. Any receipt represents simulated cash; no Stripe charge was made.',
      createdAt,
    };
  });
}
