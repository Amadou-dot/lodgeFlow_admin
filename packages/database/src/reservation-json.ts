import type { Types } from 'mongoose';
import type { IDiningReservation } from './models/DiningReservation';
import type { IExperienceBooking } from './models/ExperienceBooking';
import type {
  ReservationPaymentState,
  ReservationReceipt,
} from './reservation-payment-state';
import {
  serializeDining,
  type DiningJson,
  type DiningJsonSource,
} from './dining-json';
import {
  serializeExperience,
  type ExperienceJson,
  type ExperienceJsonSource,
} from './experience-json';

export type ReservationReceiptJson = Omit<ReservationReceipt, 'recordedAt'> & {
  recordedAt: string;
};
export interface ReservationPaymentJson {
  receipts?: ReservationReceiptJson[];
  paymentConfirmationSentAt?: string;
  checkout?: Omit<
    NonNullable<ReservationPaymentState['checkout']>,
    'createdAt'
  > & { createdAt: string };
  stripeRefund?: Omit<
    NonNullable<ReservationPaymentState['stripeRefund']>,
    'createdAt'
  > & { createdAt: string };
}
type CommonFields = Pick<
  IDiningReservation,
  | 'customer'
  | 'totalPrice'
  | 'isPaid'
  | 'stripePaymentIntentId'
  | 'specialRequests'
>;
type DiningFields = Pick<
  IDiningReservation,
  | 'time'
  | 'numGuests'
  | 'status'
  | 'dietaryRequirements'
  | 'tablePreference'
  | 'occasion'
>;
type ExperienceFields = Pick<
  IExperienceBooking,
  'timeSlot' | 'numParticipants' | 'status' | 'observations'
>;
interface ReservationJson extends CommonFields, ReservationPaymentJson {
  _id: string;
  date: string;
  createdAt?: string;
  updatedAt?: string;
  id?: string;
  __v?: number;
}
export type DiningReservationJson<Reference = string> = ReservationJson &
  DiningFields & { dining: Reference };
export type ExperienceReservationJson<Reference = string> = ReservationJson &
  ExperienceFields & { experience: Reference };
export type DiningReservationDetail = DiningReservationJson<DiningJson | null>;
export type ExperienceReservationDetail =
  ExperienceReservationJson<ExperienceJson | null>;
export type DiningReservationHistory = DiningReservationJson<
  | (Pick<
      DiningJson,
      | '_id'
      | 'name'
      | 'image'
      | 'price'
      | 'type'
      | 'mealType'
      | 'servingTime'
      | 'location'
    > & { maxPeople?: number })
  | null
>;
export type ExperienceReservationHistory = ExperienceReservationJson<Pick<
  ExperienceJson,
  '_id' | 'name' | 'image' | 'price' | 'duration' | 'category' | 'location'
> | null>;
export type DiningReservationSource = CommonFields &
  DiningFields &
  ReservationSource;
export type ExperienceReservationSource = CommonFields &
  ExperienceFields &
  ReservationSource;
interface ReservationSource extends Omit<ReservationPaymentState, 'receipts'> {
  receipts?: ReservationReceipt[];
  _id: Types.ObjectId;
  date: Date;
  createdAt?: Date;
  updatedAt?: Date;
  id?: string;
  __v?: number;
}
function serializeCommon(
  row: ReservationSource & CommonFields
): ReservationJson {
  return {
    _id: row._id.toHexString(),
    id: row.id,
    __v: row.__v,
    customer: row.customer,
    date: row.date.toISOString(),
    createdAt:
      row.createdAt == null ? row.createdAt : row.createdAt.toISOString(),
    updatedAt:
      row.updatedAt == null ? row.updatedAt : row.updatedAt.toISOString(),
    totalPrice: row.totalPrice,
    isPaid: row.isPaid,
    stripePaymentIntentId: row.stripePaymentIntentId,
    specialRequests:
      row.specialRequests == null
        ? row.specialRequests
        : [...row.specialRequests],
    receipts:
      row.receipts == null
        ? row.receipts
        : row.receipts.map(receipt => ({
            id: receipt.id,
            type: receipt.type,
            amountCents: receipt.amountCents,
            method: receipt.method,
            reference: receipt.reference,
            actor: receipt.actor,
            recordedAt: receipt.recordedAt.toISOString(),
          })),
    paymentConfirmationSentAt:
      row.paymentConfirmationSentAt == null
        ? row.paymentConfirmationSentAt
        : row.paymentConfirmationSentAt.toISOString(),
    checkout:
      row.checkout == null
        ? row.checkout
        : {
            token: row.checkout.token,
            amountCents: row.checkout.amountCents,
            currency: row.checkout.currency,
            createdAt:
              row.checkout.createdAt == null
                ? row.checkout.createdAt
                : row.checkout.createdAt.toISOString(),
            sessionId: row.checkout.sessionId,
            pending: row.checkout.pending,
          },
    stripeRefund:
      row.stripeRefund == null
        ? row.stripeRefund
        : {
            token: row.stripeRefund.token,
            amountCents: row.stripeRefund.amountCents,
            createdAt:
              row.stripeRefund.createdAt == null
                ? row.stripeRefund.createdAt
                : row.stripeRefund.createdAt.toISOString(),
            refundId: row.stripeRefund.refundId,
            status: row.stripeRefund.status,
            actor: row.stripeRefund.actor,
            reference: row.stripeRefund.reference,
          },
  };
}
export function serializeDiningReservation<Reference>({
  reservation,
  dining,
}: {
  reservation: DiningReservationSource;
  dining: Reference;
}): DiningReservationJson<Reference> {
  return {
    ...serializeCommon(reservation),
    dining,
    time: reservation.time,
    numGuests: reservation.numGuests,
    status: reservation.status,
    dietaryRequirements:
      reservation.dietaryRequirements == null
        ? reservation.dietaryRequirements
        : [...reservation.dietaryRequirements],
    tablePreference: reservation.tablePreference,
    occasion: reservation.occasion,
  };
}
export function serializeExperienceReservation<Reference>({
  reservation,
  experience,
}: {
  reservation: ExperienceReservationSource;
  experience: Reference;
}): ExperienceReservationJson<Reference> {
  return {
    ...serializeCommon(reservation),
    experience,
    timeSlot: reservation.timeSlot,
    numParticipants: reservation.numParticipants,
    status: reservation.status,
    observations: reservation.observations,
  };
}
export function serializeDiningReservationDetail(
  reservation: DiningReservationSource & { dining: DiningJsonSource | null }
): DiningReservationDetail {
  return serializeDiningReservation({
    reservation,
    dining:
      reservation.dining === null ? null : serializeDining(reservation.dining),
  });
}
export function serializeExperienceReservationDetail(
  reservation: ExperienceReservationSource & {
    experience: ExperienceJsonSource | null;
  }
): ExperienceReservationDetail {
  return serializeExperienceReservation({
    reservation,
    experience:
      reservation.experience === null
        ? null
        : serializeExperience(reservation.experience),
  });
}
type DiningProjection = Pick<
  DiningJsonSource,
  | '_id'
  | 'name'
  | 'image'
  | 'price'
  | 'type'
  | 'mealType'
  | 'servingTime'
  | 'location'
> & { maxPeople?: number };
type ExperienceProjection = Pick<
  ExperienceJsonSource,
  '_id' | 'name' | 'image' | 'price' | 'duration' | 'category' | 'location'
>;
export type DiningHistorySource = DiningReservationSource & {
  dining: DiningProjection | null;
};
export type ExperienceHistorySource = ExperienceReservationSource & {
  experience: ExperienceProjection | null;
};
export function serializeDiningReservationHistory(
  reservation: DiningHistorySource
): DiningReservationHistory {
  const row = reservation.dining;
  return serializeDiningReservation({
    reservation,
    dining:
      row === null
        ? null
        : {
            _id: row._id.toHexString(),
            name: row.name,
            image: row.image,
            price: row.price,
            type: row.type,
            mealType: row.mealType,
            servingTime:
              row.servingTime == null
                ? row.servingTime
                : { start: row.servingTime.start, end: row.servingTime.end },
            location: row.location,
            maxPeople: row.maxPeople,
          },
  });
}
export function serializeExperienceReservationHistory(
  reservation: ExperienceHistorySource
): ExperienceReservationHistory {
  const row = reservation.experience;
  return serializeExperienceReservation({
    reservation,
    experience:
      row === null
        ? null
        : {
            _id: row._id.toHexString(),
            name: row.name,
            image: row.image,
            price: row.price,
            duration: row.duration,
            category: row.category,
            location: row.location,
          },
  });
}
export function serializeUnpopulatedReservation(
  reservation: IDiningReservation | IExperienceBooking
) {
  return 'dining' in reservation
    ? serializeDiningReservation({
        reservation: reservation.toObject(),
        dining: reservation.dining.toHexString(),
      })
    : serializeExperienceReservation({
        reservation: reservation.toObject(),
        experience: reservation.experience.toHexString(),
      });
}
