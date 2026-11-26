import { cabinJsonSchema } from '@lodgeflow/database/catalog-json-schema';
import { z } from 'zod';

const count = z.number().int().nonnegative();

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
  cabinJsonSchema.refine(row => !('success' in row)),
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
