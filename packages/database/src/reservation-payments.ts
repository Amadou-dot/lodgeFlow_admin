import mongoose from 'mongoose';
import DiningReservation from './models/DiningReservation';
import ExperienceBooking from './models/ExperienceBooking';
import { ReservationRuleError } from './reservation-capacity';
import {
  reservationPaymentSummary,
  type ReservationReceipt,
} from './reservation-payment-state';

export async function recordReservationReceipt({
  kind,
  id,
  receipt,
}: {
  kind: 'dining' | 'experience';
  id: string;
  receipt: Omit<ReservationReceipt, 'recordedAt'>;
}) {
  if (!mongoose.isValidObjectId(id))
    throw new ReservationRuleError('Invalid reservation ID');
  if (!Number.isSafeInteger(receipt.amountCents) || receipt.amountCents <= 0)
    throw new ReservationRuleError(
      'Amount must be a positive whole number of cents'
    );
  for (let attempt = 0; attempt < 5; attempt++) {
    const reservation =
      kind === 'dining'
        ? await DiningReservation.findById(id)
        : await ExperienceBooking.findById(id);
    if (!reservation)
      throw new ReservationRuleError('Reservation not found', 404);
    const existing = reservation.receipts.find(
      (row: ReservationReceipt) => row.id === receipt.id
    );
    if (existing) {
      if (
        existing.type !== receipt.type ||
        existing.amountCents !== receipt.amountCents ||
        existing.method !== receipt.method ||
        existing.reference !== receipt.reference ||
        existing.actor !== receipt.actor
      )
        throw new ReservationRuleError(
          'Request ID already used for a different transaction',
          409
        );
      return { reservation, changed: false };
    }
    const summary = reservationPaymentSummary(reservation);
    if (
      reservation.checkout?.pending ||
      reservation.stripeRefund?.status === 'pending'
    )
      throw new ReservationRuleError('An online transaction is pending', 409);
    if (summary.legacyPaid)
      throw new ReservationRuleError(
        'This payment requires reconciliation before recording transactions',
        409
      );
    if (receipt.type === 'payment') {
      if (['cancelled', 'no-show'].includes(reservation.status))
        throw new ReservationRuleError(
          'This reservation cannot receive payments'
        );
      if (receipt.amountCents > summary.balanceCents)
        throw new ReservationRuleError(
          'Payment exceeds the outstanding balance'
        );
    } else {
      // Refund each tender only up to the amount actually collected on it.
      const available = reservation.receipts.reduce(
        (sum: number, row: ReservationReceipt) =>
          sum +
          (row.method === receipt.method
            ? row.type === 'payment'
              ? row.amountCents
              : -row.amountCents
            : 0),
        0
      );
      if (
        receipt.amountCents > summary.refundableCents ||
        receipt.amountCents > available
      )
        throw new ReservationRuleError(
          'Refund exceeds payments available for this method'
        );
    }
    reservation.receipts.push({ ...receipt, recordedAt: new Date() });
    reservation.isPaid =
      reservationPaymentSummary(reservation).balanceCents === 0;
    try {
      await reservation.save();
      return { reservation, changed: true };
    } catch (error) {
      if (!(error instanceof mongoose.Error.VersionError)) throw error;
    }
  }
  throw new ReservationRuleError(
    'Reservation changed; retry the same request',
    409
  );
}
