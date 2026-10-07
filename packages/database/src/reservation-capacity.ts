import type { DiningJsonSource } from './dining-json';
import type { ExperienceJsonSource } from './experience-json';
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
function validateCount({
  count,
  min,
  max,
}: {
  count: number;
  min: number;
  max?: number;
}) {
  if (
    !Number.isInteger(count) ||
    count < min ||
    (max !== undefined && count > max)
  )
    throw new ReservationRuleError(
      `Party size must be an integer between ${min} and ${max ?? 500}`
    );
}

export interface CapacityCatalogReference {
  kind: 'dining' | 'experience';
  listingId: string;
}

/** All capacity writers touch the same catalog document inside their transaction.
 * This creates an actual write conflict; a read/count alone permits write skew. */
async function withCatalog<T>(
  { kind, listingId: id }: CapacityCatalogReference,
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
  validateCount({
    count: reservation.numGuests,
    min: dining.minPeople,
    max: dining.maxPeople,
  });
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
type ReservationChange<Selection> =
  | { action: 'update'; updates: Partial<Selection> }
  | { action: 'cancel'; updates?: never };

export interface CreateDiningReservationInput {
  diningId: string;
  customerId: string;
  selection: DiningSelection;
}
export type UpdateDiningReservationInput = {
  reservationId: string;
  customerId: string;
} & ReservationChange<DiningSelection>;

export async function createDiningReservation({
  diningId,
  customerId: customer,
  selection,
}: CreateDiningReservationInput) {
  const id = await withCatalog(
    { kind: 'dining', listingId: diningId },
    async (catalog, session) => {
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
    }
  );
  return DiningReservation.findById(id).populate<{
    dining: DiningJsonSource | null;
  }>('dining');
}
export async function updateDiningReservation(
  input: UpdateDiningReservationInput
) {
  const { reservationId: id, customerId: customer } = input;
  requireId(id);
  const initial = await DiningReservation.findOne({ _id: id, customer });
  if (!initial) throw new ReservationRuleError('Reservation not found', 404);
  await withCatalog(
    { kind: 'dining', listingId: String(initial.dining) },
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
        input.action === 'cancel' &&
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
      if (input.action === 'cancel') reservation.status = 'cancelled';
      else {
        if (
          (reservation.isPaid || reservation.receipts?.length > 0) &&
          ['date', 'time', 'numGuests'].some(key => key in input.updates)
        )
          throw new ReservationRuleError(
            'Paid reservations cannot be repriced or moved',
            409
          );
        Object.assign(reservation, input.updates);
        await checkDining(catalog as IDining, reservation, session);
      }
      await reservation.save({ session });
    }
  );
  return DiningReservation.findById(id).populate<{
    dining: DiningJsonSource | null;
  }>('dining');
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
  validateCount({
    count: booking.numParticipants,
    min: 1,
    max: experience.maxParticipants,
  });
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
export interface CreateExperienceReservationInput {
  experienceId: string;
  customerId: string;
  selection: ExperienceSelection;
}
export type UpdateExperienceReservationInput = {
  reservationId: string;
  customerId: string;
} & ReservationChange<ExperienceSelection>;

export async function createExperienceReservation({
  experienceId,
  customerId: customer,
  selection,
}: CreateExperienceReservationInput) {
  const id = await withCatalog(
    { kind: 'experience', listingId: experienceId },
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
  return ExperienceBooking.findById(id).populate<{
    experience: ExperienceJsonSource | null;
  }>('experience');
}
export async function updateExperienceReservation(
  input: UpdateExperienceReservationInput
) {
  const { reservationId: id, customerId: customer } = input;
  requireId(id);
  const initial = await ExperienceBooking.findOne({ _id: id, customer });
  if (!initial) throw new ReservationRuleError('Reservation not found', 404);
  await withCatalog(
    { kind: 'experience', listingId: String(initial.experience) },
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
        input.action === 'cancel' &&
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
      if (input.action === 'cancel') booking.status = 'cancelled';
      else {
        if (
          (booking.isPaid || booking.receipts?.length > 0) &&
          ['date', 'timeSlot', 'numParticipants'].some(
            key => key in input.updates
          )
        )
          throw new ReservationRuleError(
            'Paid reservations cannot be repriced or moved',
            409
          );
        Object.assign(booking, input.updates);
        await checkExperience(catalog as IExperience, booking, session);
      }
      await booking.save({ session });
    }
  );
  return ExperienceBooking.findById(id).populate<{
    experience: ExperienceJsonSource | null;
  }>('experience');
}

type DiningCatalogUpdates = Partial<
  Pick<
    IDining,
    | 'name'
    | 'description'
    | 'type'
    | 'mealType'
    | 'category'
    | 'subCategory'
    | 'price'
    | 'servingTime'
    | 'maxPeople'
    | 'minPeople'
    | 'image'
    | 'gallery'
    | 'ingredients'
    | 'allergens'
    | 'dietary'
    | 'beverages'
    | 'includes'
    | 'duration'
    | 'location'
    | 'specialRequirements'
    | 'isPopular'
    | 'isAvailable'
    | 'seasonality'
    | 'tags'
    | 'rating'
    | 'reviewCount'
  >
>;
type ExperienceCatalogUpdates = Partial<
  Pick<
    IExperience,
    | 'name'
    | 'description'
    | 'duration'
    | 'price'
    | 'difficulty'
    | 'category'
    | 'image'
    | 'includes'
    | 'available'
    | 'ctaText'
    | 'longDescription'
    | 'gallery'
    | 'isPopular'
    | 'maxParticipants'
    | 'minAge'
    | 'requirements'
    | 'location'
    | 'highlights'
    | 'whatToBring'
    | 'cancellationPolicy'
    | 'seasonality'
    | 'tags'
    | 'rating'
    | 'reviewCount'
  >
>;
export type UpdateCapacityCatalogInput = { listingId: string } & (
  | { kind: 'dining'; updates: DiningCatalogUpdates }
  | { kind: 'experience'; updates: ExperienceCatalogUpdates }
);

export async function updateCapacityCatalog({
  kind,
  listingId: id,
  updates,
}: UpdateCapacityCatalogInput) {
  return withCatalog({ kind, listingId: id }, async (catalog, session) => {
    Object.assign(catalog, updates);
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    if (kind === 'dining') {
      const dining = catalog as IDining;
      if (dining.minPeople > dining.maxPeople)
        throw new ReservationRuleError(
          'Minimum guests cannot exceed maximum guests'
        );
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

export async function deleteCapacityCatalog({
  kind,
  listingId: id,
}: CapacityCatalogReference) {
  return withCatalog({ kind, listingId: id }, async (catalog, session) => {
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

export interface TransitionCapacityReservationInput {
  kind: 'dining' | 'experience';
  reservationId: string;
  // Request strings are compared/validated inside the transaction so missing
  // and stale reservations keep precedence over invalid transition errors.
  expectedStatus: string;
  nextStatus: string;
}

/** Staff status edits use the same catalog lock as guest capacity writers. */
export async function transitionCapacityReservation({
  kind,
  reservationId: id,
  expectedStatus,
  nextStatus,
}: TransitionCapacityReservationInput) {
  requireId(id);
  const initial =
    kind === 'dining'
      ? await DiningReservation.findById(id)
      : await ExperienceBooking.findById(id);
  if (!initial) throw new ReservationRuleError('Reservation not found', 404);
  const resourceId = String(
    initial.get(kind === 'dining' ? 'dining' : 'experience')
  );
  return withCatalog(
    { kind, listingId: resourceId },
    async (_catalog, session) => {
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
    }
  );
}
