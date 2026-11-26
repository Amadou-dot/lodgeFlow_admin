import { CABIN_STATUSES } from '@lodgeflow/database/config';
import { z } from 'zod';

const objectId = z.string().regex(/^[a-f0-9]{24}$/i);
const text = z.string().min(1);
const optionalNumber = z.number().nullish();
const count = z.number().int().nonnegative();

// Accept the full canonical Date.toISOString() range, including signed years.
const timestamp = z.string().refine(value => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
});

const cabinJsonSchema = z.looseObject({
  _id: objectId,
  id: objectId,
  name: text,
  image: text,
  images: z.array(text).nullable(),
  capacity: z.number(),
  price: z.number(),
  discount: z.number().nullable(),
  description: text,
  status: z.enum(CABIN_STATUSES).nullable(),
  bedrooms: optionalNumber,
  bathrooms: optionalNumber,
  size: optionalNumber,
  minNights: optionalNumber,
  amenities: z.array(z.string().nullable()),
  extraGuestFee: optionalNumber,
  discountedPrice: z.number().optional(),
  createdAt: timestamp.nullish(),
  updatedAt: timestamp.nullish(),
  __v: optionalNumber,
});

function successEnvelope<T extends z.ZodType>(data: T) {
  return z.looseObject({
    success: z.literal(true),
    data,
    message: z.string().optional(),
    error: z.never().optional(),
  });
}

const cabinListJsonSchema = z.array(cabinJsonSchema);

export const cabinListResponseSchema = z.union([
  successEnvelope(cabinListJsonSchema).transform(result => result.data),
  cabinListJsonSchema,
]);
export const cabinResponseSchema = z.union([
  successEnvelope(cabinJsonSchema).transform(result => result.data),
  cabinJsonSchema.extend({ success: z.never().optional() }),
]);
export const cabinDeleteResponseSchema = successEnvelope(z.null());
export const cabinBulkDeleteResponseSchema = successEnvelope(
  z.looseObject({ deletedCount: count, modifiedCount: z.never().optional() })
).transform(result => result.data);
export const cabinBulkDiscountResponseSchema = successEnvelope(
  z.looseObject({ modifiedCount: count, deletedCount: z.never().optional() })
).transform(result => result.data);

export const cabinMutationErrorSchema = z.object({
  error: z.string().catch(''),
  message: z.string().catch(''),
});
