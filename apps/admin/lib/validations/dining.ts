import { priceAmountSchema } from './money';
import { objectRequestSchema } from './object-request';
import {
  BEVERAGE_CATEGORIES,
  DIETARY_OPTIONS,
  DINING_CATEGORIES,
  DINING_TYPES,
  MEAL_TYPES,
} from '@/lib/config';
import { z } from 'zod';

/**
 * Time format regex (HH:MM)
 */
const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

/**
 * Serving time schema
 */
const servingTimeSchema = z.strictObject({
  start: z.string().regex(timeRegex, 'Invalid time format. Use HH:MM'),
  end: z.string().regex(timeRegex, 'Invalid time format. Use HH:MM'),
});

/**
 * Dining type enum — matches the Dining Mongoose model
 */
export const diningTypeSchema = z.enum(DINING_TYPES);

/**
 * Meal type enum — matches the Dining Mongoose model
 */
export const mealTypeSchema = z.enum(MEAL_TYPES);

/**
 * Category enum — matches the Dining Mongoose model
 */
export const diningCategorySchema = z.enum(DINING_CATEGORIES);

/**
 * Dietary option enum — matches the Dining Mongoose model
 */
export const dietaryOptionSchema = z.enum(DIETARY_OPTIONS);

/**
 * Beverage sub-schema — matches the Dining Mongoose model's beverages array
 */
const beverageSchema = z.strictObject({
  name: z.string().min(1, 'Beverage name is required'),
  description: z.string().optional(),
  price: z.number().min(0).pipe(priceAmountSchema).optional(),
  alcoholContent: z.number().min(0).optional(),
  category: z.enum(BEVERAGE_CATEGORIES),
});

/**
 * Description length bounds — kept as constants so create/update can't
 * drift apart.
 */
const DINING_DESCRIPTION_MIN = 10;
const DINING_DESCRIPTION_MAX = 1000;

/**
 * Create dining item request schema
 */
const createFieldsSchema = z
  .strictObject({
    name: z.string().min(1, 'Name is required').max(100),
    description: z
      .string()
      .min(DINING_DESCRIPTION_MIN, 'Description must be at least 10 characters')
      .max(DINING_DESCRIPTION_MAX),
    type: diningTypeSchema,
    mealType: mealTypeSchema,
    category: diningCategorySchema,
    subCategory: z.string().max(50).optional(),
    price: z
      .number()
      .positive('Price must be positive')
      .pipe(priceAmountSchema),
    servingTime: servingTimeSchema,
    maxPeople: z.number().int().min(1).max(100),
    minPeople: z.number().int().min(1).optional().default(1),
    image: z.string().url('Invalid image URL'),
    gallery: z.array(z.string().url('Invalid image URL')).optional(),
    ingredients: z.array(z.string()).optional(),
    allergens: z.array(z.string()).optional(),
    dietary: z.array(dietaryOptionSchema).optional(),
    beverages: z.array(beverageSchema).optional(),
    includes: z.array(z.string()).optional(),
    duration: z.string().optional(),
    location: z.string().optional(),
    specialRequirements: z.array(z.string()).optional(),
    isPopular: z.boolean().optional().default(false),
    isAvailable: z.boolean().optional().default(true),
    seasonality: z.string().optional(),
    tags: z.array(z.string()).optional(),
    rating: z.number().min(0).max(5).optional(),
    reviewCount: z.number().int().min(0).optional().default(0),
  })
  .refine(data => data.minPeople <= data.maxPeople, {
    path: ['minPeople'],
    message: 'Minimum guests cannot exceed maximum guests',
  });

/**
 * Update dining item request schema (all fields optional except _id).
 *
 * Deliberately not derived via `.partial()` on the create schema — fields
 * there carry `.default()`, which Zod applies even when the key is absent
 * from a partial update, silently resetting them to create-time defaults.
 */
const updateFieldsSchema = z
  .strictObject({
    _id: z
      .string()
      .min(1, 'Dining item ID is required')
      .regex(/^[a-f\d]{24}$/i, 'Invalid catalog ID'),
    name: z.string().min(1).max(100).optional(),
    description: z
      .string()
      .min(DINING_DESCRIPTION_MIN)
      .max(DINING_DESCRIPTION_MAX)
      .optional(),
    type: diningTypeSchema.optional(),
    mealType: mealTypeSchema.optional(),
    category: diningCategorySchema.optional(),
    subCategory: z.string().max(50).optional(),
    price: z.number().positive().pipe(priceAmountSchema).optional(),
    servingTime: servingTimeSchema.optional(),
    maxPeople: z.number().int().min(1).max(100).optional(),
    minPeople: z.number().int().min(1).optional(),
    image: z.string().url().optional(),
    gallery: z.array(z.string().url('Invalid image URL')).optional(),
    ingredients: z.array(z.string()).optional(),
    allergens: z.array(z.string()).optional(),
    dietary: z.array(dietaryOptionSchema).optional(),
    beverages: z.array(beverageSchema).optional(),
    includes: z.array(z.string()).optional(),
    duration: z.string().optional(),
    location: z.string().optional(),
    specialRequirements: z.array(z.string()).optional(),
    isPopular: z.boolean().optional(),
    isAvailable: z.boolean().optional(),
    seasonality: z.string().optional(),
    tags: z.array(z.string()).optional(),
    rating: z.number().min(0).max(5).optional(),
    reviewCount: z.number().int().min(0).optional(),
  })
  .refine(
    data =>
      data.minPeople === undefined ||
      data.maxPeople === undefined ||
      data.minPeople <= data.maxPeople,
    {
      path: ['minPeople'],
      message: 'Minimum guests cannot exceed maximum guests',
    }
  );

export const createDiningSchema = objectRequestSchema.pipe(createFieldsSchema);
export const updateDiningSchema = objectRequestSchema.pipe(updateFieldsSchema);

export type CreateDiningInput = z.input<typeof createFieldsSchema>;
export type UpdateDiningInput = z.input<typeof updateFieldsSchema>;
