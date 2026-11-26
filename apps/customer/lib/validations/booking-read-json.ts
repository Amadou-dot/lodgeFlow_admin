import type { BookingDetailCabin } from '@lodgeflow/database/booking-json';
import { z } from 'zod';
import { cabinJsonSchema } from '@lodgeflow/database/catalog-json-schema';
import {
  bookingFields,
  objectId,
} from '@lodgeflow/database/reservation-read-fields';
import { CABIN_STATUSES } from '@lodgeflow/database/config';
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
