import { reservationPaymentSummary } from './reservation-payment-state';
import {
  DINING_STATUS_TRANSITIONS,
  EXPERIENCE_STATUS_TRANSITIONS,
} from './config';
import mongoose, { type ClientSession } from 'mongoose';
import Dining, { type IDining } from './models/Dining';
import { Experience, type IExperience } from './models/Experience';
import DiningReservation, {
  type IDiningReservation,
} from './models/DiningReservation';
import ExperienceBooking, {
  type IExperienceBooking,
} from './models/ExperienceBooking';
import { roundMoney } from './booking-payments';

export class ReservationRuleError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
    this.name = 'ReservationRuleError';
    Object.setPrototypeOf(this, ReservationRuleError.prototype);
  }
}
function requireId(id: string) {
  if (!mongoose.isValidObjectId(id))
    throw new ReservationRuleError('Reservation or listing not found', 404);
}
function dayRange(date: Date) {
  if (!Number.isFinite(date.getTime()))
    throw new ReservationRuleError('Invalid reservation date');
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { $gte: start, $lt: end };
}
function validateDate(date: Date) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (dayRange(date).$gte < today)
    throw new ReservationRuleError('Cannot reserve a date in the past');
}
function validateCount(count: number, min: number, max?: number) {
  if (
    !Number.isInteger(count) ||
    count < min ||
    (max !== undefined && count > max)
  )
    throw new ReservationRuleError(
      `Party size must be an integer between ${min} and ${max ?? 500}`
    );
}

/** All capacity writers touch the same catalog document inside their transaction.
 * This creates an actual write conflict; a read/count alone permits write skew. */
async function withCatalog<T>(
  kind: 'dining' | 'experience',
  id: string,
  work: (
    catalog: (IDining | IExperience) & mongoose.Document,
    session: ClientSession
  ) => Promise<T>
): Promise<T> {
  requireId(id);
  const session = await mongoose.startSession();
  try {
    return (await session.withTransaction(async () => {
      const update = { $inc: { reservationVersion: 1 } };
      const options = { session, new: true };
      const catalog =
        kind === 'dining'
          ? await Dining.findByIdAndUpdate(id, update, options)
          : await Experience.findByIdAndUpdate(id, update, options);
      if (!catalog) throw new ReservationRuleError('Listing not found', 404);
      return work(catalog, session);
    }))!;
  } finally {
    await session.endSession();
  }
}

export type DiningSelection = Pick<
  IDiningReservation,
  | 'date'
  | 'time'
  | 'numGuests'
  | 'dietaryRequirements'
  | 'specialRequests'
  | 'tablePreference'
  | 'occasion'
>;
async function checkDining(
  dining: IDining,
  reservation: IDiningReservation,
  session: ClientSession
) {
  if (!dining.isAvailable)
    throw new ReservationRuleError('Dining option is unavailable');
  validateDate(reservation.date);
  validateCount(reservation.numGuests, dining.minPeople, dining.maxPeople);
  if (
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(reservation.time) ||
    reservation.time < dining.servingTime.start ||
    reservation.time > dining.servingTime.end
  )
    throw new ReservationRuleError(
      `Choose a time between ${dining.servingTime.start} and ${dining.servingTime.end}`
    );
  const rows = await DiningReservation.find({
    _id: { $ne: reservation._id },
    dining: dining._id,
    date: dayRange(reservation.date),
    time: reservation.time,
    status: { $nin: ['cancelled', 'no-show'] },
  }).session(session);
  const occupied = rows.reduce(
    (sum: number, row: IDiningReservation) => sum + row.numGuests,
    0
  );
  if (occupied + reservation.numGuests > dining.maxPeople)
    throw new ReservationRuleError('Not enough dining seats available', 409);
  if (!reservation.isPaid && !reservation.receipts?.length)
    reservation.totalPrice = roundMoney(dining.price * reservation.numGuests);
}
export async function createDiningReservation(
  diningId: string,
  customer: string,
  selection: DiningSelection
) {
  const id = await withCatalog('dining', diningId, async (catalog, session) => {
    const reservation = new DiningReservation({
      ...selection,
      dining: diningId,
      customer,
      status: 'pending',
      isPaid: false,
    });
    await checkDining(catalog as IDining, reservation, session);
    await reservation.save({ session });
    return reservation._id;
  });
  return DiningReservation.findById(id).populate('dining');
}
export async function updateDiningReservation(
  id: string,
  customer: string,
  updates: Partial<DiningSelection>,
  cancel = false
) {
  requireId(id);
  const initial = await DiningReservation.findOne({ _id: id, customer });
  if (!initial) throw new ReservationRuleError('Reservation not found', 404);
  await withCatalog(
    'dining',
    String(initial.dining),
    async (catalog, session) => {
      const reservation = await DiningReservation.findOne({
        _id: id,
        customer,
      }).session(session);
      if (!reservation)
        throw new ReservationRuleError('Reservation not found', 404);
      if (['cancelled', 'completed', 'no-show'].includes(reservation.status))
        throw new ReservationRuleError(
          'This reservation can no longer be changed'
        );
      if (
        cancel &&
        (reservationPaymentSummary(reservation).legacyPaid ||
          reservationPaymentSummary(reservation).refundableCents > 0)
      )
        throw new ReservationRuleError(
          'Contact the property to cancel a paid reservation',
          409
        );
      if (
        reservation.checkout?.pending ||
        reservation.stripeRefund?.status === 'pending'
      )
        throw new ReservationRuleError('An online transaction is pending', 409);
      if (cancel) reservation.status = 'cancelled';
      else {
        if (
          (reservation.isPaid || reservation.receipts?.length > 0) &&
          ['date', 'time', 'numGuests'].some(key => key in updates)
        )
          throw new ReservationRuleError(
            'Paid reservations cannot be repriced or moved',
            409
          );
        Object.assign(reservation, updates);
        await checkDining(catalog as IDining, reservation, session);
      }
      await reservation.save({ session });
    }
  );
  return DiningReservation.findById(id).populate('dining');
}

export type ExperienceSelection = Pick<
  IExperienceBooking,
  'date' | 'timeSlot' | 'numParticipants' | 'specialRequests' | 'observations'
>;
async function checkExperience(
  experience: IExperience,
  booking: IExperienceBooking,
  session: ClientSession
) {
  validateDate(booking.date);
  validateCount(booking.numParticipants, 1, experience.maxParticipants);
  const rows = await ExperienceBooking.find({
    _id: { $ne: booking._id },
    experience: experience._id,
    date: dayRange(booking.date),
    status: { $ne: 'cancelled' },
  }).session(session);
  const occupied = rows.reduce(
    (sum: number, row: IExperienceBooking) => sum + row.numParticipants,
    0
  );
  // Preserve the existing per-day capacity contract; timeSlot is descriptive.
  if (
    experience.maxParticipants !== undefined &&
    occupied + booking.numParticipants > experience.maxParticipants
  )
    throw new ReservationRuleError(
      'Not enough experience spots available',
      409
    );
  if (!booking.isPaid && !booking.receipts?.length)
    booking.totalPrice = roundMoney(experience.price * booking.numParticipants);
}
export async function createExperienceReservation(
  experienceId: string,
  customer: string,
  selection: ExperienceSelection
) {
  const id = await withCatalog(
    'experience',
    experienceId,
    async (catalog, session) => {
      const booking = new ExperienceBooking({
        ...selection,
        experience: experienceId,
        customer,
        status: 'pending',
        isPaid: false,
      });
      await checkExperience(catalog as IExperience, booking, session);
      await booking.save({ session });
      return booking._id;
    }
  );
  return ExperienceBooking.findById(id).populate('experience');
}
export async function updateExperienceReservation(
  id: string,
  customer: string,
  updates: Partial<ExperienceSelection>,
  cancel = false
) {
  requireId(id);
  const initial = await ExperienceBooking.findOne({ _id: id, customer });
  if (!initial) throw new ReservationRuleError('Reservation not found', 404);
  await withCatalog(
    'experience',
    String(initial.experience),
    async (catalog, session) => {
      const booking = await ExperienceBooking.findOne({
        _id: id,
        customer,
      }).session(session);
      if (!booking)
        throw new ReservationRuleError('Reservation not found', 404);
      if (['cancelled', 'completed'].includes(booking.status))
        throw new ReservationRuleError(
          'This reservation can no longer be changed'
        );
      if (
        cancel &&
        (reservationPaymentSummary(booking).legacyPaid ||
          reservationPaymentSummary(booking).refundableCents > 0)
      )
        throw new ReservationRuleError(
          'Contact the property to cancel a paid reservation',
          409
        );
      if (
        booking.checkout?.pending ||
        booking.stripeRefund?.status === 'pending'
      )
        throw new ReservationRuleError('An online transaction is pending', 409);
      if (cancel) booking.status = 'cancelled';
      else {
        if (
          (booking.isPaid || booking.receipts?.length > 0) &&
          ['date', 'timeSlot', 'numParticipants'].some(key => key in updates)
        )
          throw new ReservationRuleError(
            'Paid reservations cannot be repriced or moved',
            409
          );
        Object.assign(booking, updates);
        await checkExperience(catalog as IExperience, booking, session);
      }
      await booking.save({ session });
    }
  );
  return ExperienceBooking.findById(id).populate('experience');
}

export async function updateCapacityCatalog(
  kind: 'dining' | 'experience',
  id: string,
  updates: Record<string, unknown>
) {
  return withCatalog(kind, id, async (catalog, session) => {
    Object.assign(catalog, updates);
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    if (kind === 'dining') {
      const dining = catalog as IDining;
      const reservations = await DiningReservation.find({
        dining: id,
        date: { $gte: start },
        status: { $nin: ['cancelled', 'no-show'] },
      }).session(session);
      const slots = new Map<string, number>();
      for (const reservation of reservations) {
        if (
          reservation.numGuests < dining.minPeople ||
          reservation.time < dining.servingTime.start ||
          reservation.time > dining.servingTime.end
        )
          throw new ReservationRuleError(
            'Existing reservations conflict with the new party size or serving hours',
            409
          );
        const key = `${reservation.date.toISOString().slice(0, 10)}:${reservation.time}`;
        slots.set(key, (slots.get(key) ?? 0) + reservation.numGuests);
      }
      if (Array.from(slots.values()).some(count => count > dining.maxPeople))
        throw new ReservationRuleError(
          'Capacity cannot be reduced below existing reservations',
          409
        );
    } else {
      const experience = catalog as IExperience;
      const reservations = await ExperienceBooking.find({
        experience: id,
        date: { $gte: start },
        status: { $ne: 'cancelled' },
      }).session(session);
      const days = new Map<string, number>();
      for (const reservation of reservations) {
        const key = reservation.date.toISOString().slice(0, 10);
        days.set(key, (days.get(key) ?? 0) + reservation.numParticipants);
      }
      if (
        experience.maxParticipants !== undefined &&
        Array.from(days.values()).some(
          count => count > experience.maxParticipants!
        )
      )
        throw new ReservationRuleError(
          'Capacity cannot be reduced below existing reservations',
          409
        );
    }
    await catalog.save({ session });
    return catalog;
  });
}

export async function deleteCapacityCatalog(
  kind: 'dining' | 'experience',
  id: string
) {
  return withCatalog(kind, id, async (catalog, session) => {
    const used =
      kind === 'dining'
        ? await DiningReservation.exists({ dining: id }).session(session)
        : await ExperienceBooking.exists({ experience: id }).session(session);
    if (used)
      throw new ReservationRuleError(
        'Cannot delete a listing referenced by reservation history',
        409
      );
    await catalog.deleteOne({ session });
    return catalog;
  });
}

/** Staff status edits use the same catalog lock as guest capacity writers. */
export async function transitionCapacityReservation(
  kind: 'dining' | 'experience',
  id: string,
  expectedStatus: string,
  nextStatus: string
) {
  requireId(id);
  const initial =
    kind === 'dining'
      ? await DiningReservation.findById(id)
      : await ExperienceBooking.findById(id);
  if (!initial) throw new ReservationRuleError('Reservation not found', 404);
  const resourceId = String(
    initial.get(kind === 'dining' ? 'dining' : 'experience')
  );
  return withCatalog(kind, resourceId, async (_catalog, session) => {
    const reservation =
      kind === 'dining'
        ? await DiningReservation.findById(id).session(session)
        : await ExperienceBooking.findById(id).session(session);
    if (!reservation)
      throw new ReservationRuleError('Reservation not found', 404);
    if (reservation.status !== expectedStatus)
      throw new ReservationRuleError(
        'Reservation changed; refresh and try again',
        409
      );
    const beforeStatus = reservation.status;
    if (nextStatus === beforeStatus)
      return { changed: false, beforeStatus, reservation };
    const transitions =
      kind === 'dining'
        ? DINING_STATUS_TRANSITIONS
        : EXPERIENCE_STATUS_TRANSITIONS;
    if (!transitions[beforeStatus]?.includes(nextStatus))
      throw new ReservationRuleError('Invalid reservation status transition');
    if (
      nextStatus === 'cancelled' &&
      (reservationPaymentSummary(reservation).legacyPaid ||
        reservationPaymentSummary(reservation).refundableCents > 0)
    )
      throw new ReservationRuleError(
        'Paid reservations require refund reconciliation before cancellation',
        409
      );
    if (
      reservation.checkout?.pending ||
      reservation.stripeRefund?.status === 'pending'
    )
      throw new ReservationRuleError('An online transaction is pending', 409);
    reservation.set('status', nextStatus);
    await reservation.save({ session });
    return { changed: true, beforeStatus, reservation };
  });
}
