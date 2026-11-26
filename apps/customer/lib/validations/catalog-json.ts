import {
  cabinJsonSchema,
  diningJsonSchema,
  experienceJsonSchema,
  leanDiningJsonSchema,
  leanExperienceJsonSchema,
} from '@lodgeflow/database/catalog-json-schema';
import { z } from 'zod';

function list<T>(row: z.ZodType<T>) {
  // All three public list readers historically default null or absent success data to [].
  return z
    .array(row)
    .nullish()
    .transform(rows => rows ?? []);
}

export const cabinListSchema = list(
  cabinJsonSchema.refine(cabin => cabin.status === 'active')
);
export const diningListSchema = list(
  diningJsonSchema.refine(dining => dining.isAvailable === true)
);
export const experienceListSchema = list(experienceJsonSchema);

export function diningDetailSchema(id: string) {
  return leanDiningJsonSchema.refine(
    row => row._id.toLowerCase() === id.toLowerCase()
  );
}
export function experienceDetailSchema(id: string) {
  return leanExperienceJsonSchema.refine(
    row => row._id.toLowerCase() === id.toLowerCase()
  );
}

const success = z.object({
  success: z.literal(true),
  data: z.unknown().optional(),
  message: z.string().optional(),
  error: z.never().optional(),
});
const failure = z.object({
  success: z.literal(false),
  error: z.string().min(1),
});

export async function readCatalogResponse<T>({
  response,
  schema,
  fallback,
}: {
  response: Response;
  schema: z.ZodType<T>;
  fallback: string;
}): Promise<T> {
  if (!response.ok) throw new Error(fallback);
  const body: unknown = await response.json().catch(() => undefined);
  const envelope = success.safeParse(body);
  if (!envelope.success) {
    const error = failure.safeParse(body);
    throw new Error(error.success ? error.data.error : fallback);
  }
  const result = schema.safeParse(envelope.data.data);
  if (!result.success) throw new Error(fallback);
  return result.data;
}
