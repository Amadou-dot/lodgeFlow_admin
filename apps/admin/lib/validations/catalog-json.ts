import {
  diningJsonSchema,
  experienceJsonSchema,
} from '@lodgeflow/database/catalog-json-schema';
import { z } from 'zod';

function successEnvelope<T extends z.ZodType>(data: T) {
  return z.looseObject({
    success: z.literal(true),
    data,
    message: z.string().optional(),
    error: z.never().optional(),
  });
}

function wrappedData<T>(data: z.ZodType<T>) {
  return successEnvelope(data).transform(result => result.data);
}

const diningListJsonSchema = z.array(diningJsonSchema);
const experienceListJsonSchema = z.array(experienceJsonSchema);

export const diningListResponseSchema = z.union([
  wrappedData(diningListJsonSchema),
  diningListJsonSchema,
]);
export const diningResponseSchema = z.union([
  wrappedData(diningJsonSchema),
  diningJsonSchema.refine(row => !('success' in row)),
]);
export const experienceListResponseSchema = z.union([
  wrappedData(experienceListJsonSchema),
  experienceListJsonSchema,
]);
export const experienceResponseSchema = z.union([
  wrappedData(experienceJsonSchema),
  experienceJsonSchema.refine(row => !('success' in row)),
]);
export const catalogDeleteResponseSchema = successEnvelope(z.null());

const errorSchema = z.object({
  error: z.string().catch(''),
  message: z.string().catch(''),
});

export async function readCatalogResponse<T>({
  response,
  schema,
  fallback,
  failure,
}: {
  response: Response;
  schema: z.ZodType<T>;
  fallback: string;
  failure?: 'server-error' | ((message: string) => void);
}): Promise<T> {
  if (!response.ok && !failure) throw new Error(fallback);

  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = errorSchema.safeParse(body);
    if (typeof failure === 'function') {
      failure((error.success && error.data.message) || fallback);
    }
    throw new Error((error.success && error.data.error) || fallback);
  }

  const result = schema.safeParse(body);
  if (!result.success) throw new Error(fallback);
  return result.data;
}
