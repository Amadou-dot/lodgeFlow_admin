import {
  BEVERAGE_CATEGORIES,
  DIETARY_OPTIONS,
  DINING_CATEGORIES,
  DINING_TYPES,
  EXPERIENCE_DIFFICULTIES,
  MEAL_TYPES,
} from '@lodgeflow/database/config';
import type { DiningJson } from '@lodgeflow/database/dining-json';
import type { ExperienceJson } from '@lodgeflow/database/experience-json';
import { z } from 'zod';

const objectId = z.string().regex(/^[a-f0-9]{24}$/i);
const text = z.string().min(1);
const nullableText = z.string().nullish();
const nullableNumber = z.number().nullish();
const nullableStringList = z.array(z.string().nullable()).nullable();

// Match Date.toISOString(), including canonical signed years.
const timestamp = z.string().refine(value => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
});

const catalogMetadata = {
  createdAt: timestamp.nullish(),
  updatedAt: timestamp.nullish(),
  __v: nullableNumber,
  reservationVersion: z.number().optional(),
};

const beverageJsonSchema = z.looseObject({
  _id: objectId,
  name: text,
  category: z.enum(BEVERAGE_CATEGORIES),
  description: nullableText,
  price: nullableNumber,
  alcoholContent: nullableNumber,
});

// Admin routes serialize hydrated documents. Lean catalog reads can omit defaults.
export const diningJsonSchema = z.looseObject({
  _id: objectId,
  name: text,
  description: text,
  image: text,
  type: z.enum(DINING_TYPES),
  mealType: z.enum(MEAL_TYPES),
  category: z.enum(DINING_CATEGORIES),
  price: z.number(),
  maxPeople: z.number(),
  minPeople: z.number().nullable(),
  servingTime: z.looseObject({ start: text, end: text }),
  subCategory: nullableText,
  duration: nullableText,
  location: nullableText,
  seasonality: nullableText,
  gallery: nullableStringList,
  ingredients: nullableStringList,
  allergens: nullableStringList,
  dietary: z.array(z.enum(DIETARY_OPTIONS).nullable()).nullable(),
  beverages: z.array(beverageJsonSchema).nullable(),
  includes: nullableStringList,
  specialRequirements: nullableStringList,
  tags: nullableStringList,
  isPopular: z.boolean().nullable(),
  isAvailable: z.boolean().nullable(),
  rating: nullableNumber,
  reviewCount: z.number().nullable(),
  ...catalogMetadata,
}) satisfies z.ZodType<DiningJson>;

export const experienceJsonSchema = z.looseObject({
  _id: objectId,
  name: text,
  description: text,
  image: text,
  price: z.number(),
  duration: text,
  difficulty: z.enum(EXPERIENCE_DIFFICULTIES),
  category: text,
  ctaText: text,
  longDescription: nullableText,
  location: nullableText,
  cancellationPolicy: nullableText,
  seasonality: nullableText,
  gallery: nullableStringList,
  includes: nullableStringList,
  available: nullableStringList,
  requirements: nullableStringList,
  highlights: nullableStringList,
  whatToBring: nullableStringList,
  tags: nullableStringList,
  isPopular: z.boolean().nullable(),
  maxParticipants: nullableNumber,
  minAge: nullableNumber,
  rating: nullableNumber,
  reviewCount: z.number().nullable(),
  ...catalogMetadata,
}) satisfies z.ZodType<ExperienceJson>;

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
  diningJsonSchema.extend({ success: z.never().optional() }),
]);
export const experienceListResponseSchema = z.union([
  wrappedData(experienceListJsonSchema),
  experienceListJsonSchema,
]);
export const experienceResponseSchema = z.union([
  wrappedData(experienceJsonSchema),
  experienceJsonSchema.extend({ success: z.never().optional() }),
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
