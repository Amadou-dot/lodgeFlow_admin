import { Types } from 'mongoose';
import type { IExperience, IExperienceBooking } from '@lodgeflow/database';
import type {
  ExperienceEmailBooking,
  ExperienceEmailExperience,
} from '@/types/experience-email';

export type ExperienceEmailSource = Pick<
  IExperience,
  'name' | 'price' | 'duration' | 'location' | 'includes' | 'whatToBring'
>;

/** Read-only populated query result; persistence methods never cross this boundary. */
export type ExperienceConfirmationRecord = Pick<
  IExperienceBooking,
  | '_id'
  | 'customer'
  | 'date'
  | 'numParticipants'
  | 'totalPrice'
  | 'timeSlot'
  | 'isPaid'
  | 'status'
  | 'paymentConfirmationSentAt'
> & { experience: ExperienceEmailSource | null };

export class ExperienceEmailReferenceError extends Error {
  constructor() {
    super('Experience not found');
    this.name = 'ExperienceEmailReferenceError';
    Object.setPrototypeOf(this, ExperienceEmailReferenceError.prototype);
  }
}

export function serializeExperienceEmailBooking(
  booking: Pick<
    IExperienceBooking,
    '_id' | 'date' | 'numParticipants' | 'totalPrice' | 'timeSlot'
  >
): ExperienceEmailBooking {
  if (!(booking._id instanceof Types.ObjectId))
    throw new TypeError('Expected a MongoDB ObjectId');
  return {
    bookingId: booking._id.toHexString(),
    date: booking.date.toISOString(),
    numParticipants: booking.numParticipants,
    totalPrice: booking.totalPrice,
    timeSlot: booking.timeSlot,
  };
}

export function serializeExperienceEmailExperience(
  experience: ExperienceEmailSource | null
): ExperienceEmailExperience {
  if (!experience) throw new ExperienceEmailReferenceError();
  return {
    name: experience.name,
    price: experience.price,
    duration: experience.duration,
    location: experience.location,
    includes: [...(experience.includes ?? [])],
    whatToBring: [...(experience.whatToBring ?? [])],
  };
}
