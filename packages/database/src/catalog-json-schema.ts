import {
  BEVERAGE_CATEGORIES,
  CABIN_STATUSES,
  DIETARY_OPTIONS,
  DINING_CATEGORIES,
  DINING_TYPES,
  EXPERIENCE_DIFFICULTIES,
  MEAL_TYPES,
} from './config';
import type { CabinDetail } from './cabin-json';
import type { DiningJson } from './dining-json';
import type { ExperienceJson } from './experience-json';
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

// Both apps serialize hydrated collections. Public detail queries use lean documents.
const hydratedDining = z.looseObject({
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

const hydratedExperience = z.looseObject({
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

const fullCabin = z
  .looseObject({
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
    bedrooms: nullableNumber,
    bathrooms: nullableNumber,
    size: nullableNumber,
    minNights: nullableNumber,
    amenities: z.array(z.string().nullable()),
    extraGuestFee: nullableNumber,
    discountedPrice: z.number().optional(),
    createdAt: timestamp.nullish(),
    updatedAt: timestamp.nullish(),
    __v: nullableNumber,
  })
  .refine(row => row.id === row._id) satisfies z.ZodType<CabinDetail>;

const leanDining = hydratedDining
  .partial({
    minPeople: true,
    gallery: true,
    ingredients: true,
    allergens: true,
    dietary: true,
    includes: true,
    specialRequirements: true,
    tags: true,
    isPopular: true,
    isAvailable: true,
    reviewCount: true,
  })
  .extend({
    beverages: z.array(beverageJsonSchema.partial({ _id: true })).nullish(),
  });

const leanExperience = hydratedExperience.partial({
  gallery: true,
  includes: true,
  available: true,
  requirements: true,
  highlights: true,
  whatToBring: true,
  tags: true,
  isPopular: true,
  reviewCount: true,
});

// Validate known fields without rebuilding transport objects or losing nested additions.
function checkedRow<T>(shape: z.ZodType<T, T>) {
  return z.custom<T>(value => shape.safeParse(value).success);
}

export const cabinJsonSchema = checkedRow(fullCabin);
export const diningJsonSchema = checkedRow(hydratedDining);
export const experienceJsonSchema = checkedRow(hydratedExperience);
export const leanDiningJsonSchema = checkedRow(leanDining);
export const leanExperienceJsonSchema = checkedRow(leanExperience);
