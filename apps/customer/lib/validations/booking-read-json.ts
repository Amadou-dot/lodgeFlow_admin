import type { BookingDetailCabin } from '@lodgeflow/database/booking-json';
import { z } from 'zod';
import { cabinJsonSchema } from '@lodgeflow/database/catalog-json-schema';
import {
  bookingFields,
  objectId,
} from '@lodgeflow/database/reservation-read-fields';
import { CABIN_STATUSES } from '@lodgeflow/database/config';
import { ownedDetail, type MutationTarget } from './mutation-response';
import type {
  CreateBookingRequest,
  UpdateBookingDetailsInput,
} from './booking';
import { decodeSuccess, forDetailId } from './read-response';

const detailCabin: z.ZodType<BookingDetailCabin, BookingDetailCabin> =
  cabinJsonSchema;
const cabinSummary = z.object({
  _id: objectId,
  name: z.string().min(1),
  image: z.string().min(1),
  capacity: z.number(),
  price: z.number(),
  description: z.string().min(1),
  images: z.array(z.string()).nullish(),
  discount: z.number().nullish(),
  status: z.enum(CABIN_STATUSES).nullish(),
  bedrooms: z.number().nullish(),
  bathrooms: z.number().nullish(),
  size: z.number().nullish(),
  minNights: z.number().nullish(),
});
export const bookingHistoryItem = bookingFields.extend({
  cabin: cabinSummary.nullable(),
});
export const bookingDetail = bookingFields.extend({
  id: objectId,
  cabin: detailCabin.nullable(),
  durationText: z.string().optional(),
  paymentStatus: z.enum(['paid', 'partial', 'unpaid']).optional(),
});
export const decodeBookingHistory = decodeSuccess(z.array(bookingHistoryItem));
export const decodeBookingDetail = (id: string) =>
  forDetailId(bookingDetail, id);

export function createdBookingResult({
  customerId,
  selection,
}: Pick<MutationTarget, 'customerId'> & { selection: CreateBookingRequest }) {
  return ownedDetail(bookingDetail, { customerId }).refine(
    row =>
      row.status === 'unconfirmed' &&
      row.numGuests === selection.numGuests &&
      Date.parse(row.checkInDate) === Date.parse(selection.checkInDate) &&
      Date.parse(row.checkOutDate) === Date.parse(selection.checkOutDate) &&
      (row.cabin === null ||
        row.cabin._id.toLowerCase() === selection.cabinId.toLowerCase())
  );
}
const extraChoices = [
  'hasBreakfast',
  'hasPets',
  'hasParking',
  'hasEarlyCheckIn',
  'hasLateCheckOut',
] as const;

export function updatedBookingResult({
  customerId,
  id,
  updates,
}: Required<MutationTarget> & { updates: UpdateBookingDetailsInput }) {
  return ownedDetail(bookingDetail, { customerId, id }).refine(row => {
    const requested = updates.specialRequests;
    return (
      (row.status === 'confirmed' || row.status === 'unconfirmed') &&
      (updates.numGuests === undefined ||
        row.numGuests === updates.numGuests) &&
      (requested === undefined ||
        (row.specialRequests?.length === requested.length &&
          requested.every(
            (text, index) => text.trim() === row.specialRequests?.[index]
          ))) &&
      extraChoices.every(
        key =>
          updates.extras?.[key] === undefined ||
          row.extras?.[key] === updates.extras[key]
      )
    );
  });
}
