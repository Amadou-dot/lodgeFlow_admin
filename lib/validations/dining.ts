import { z } from 'zod';

/**
 * Time format regex (HH:MM)
 */
const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

/**
 * Serving time schema
 */
const servingTimeSchema = z.object({
  start: z.string().regex(timeRegex, 'Invalid time format. Use HH:MM'),
  end: z.string().regex(timeRegex, 'Invalid time format. Use HH:MM'),
});

/**
 * Dining type enum — matches the Dining Mongoose model
 */
export const diningTypeSchema = z.enum(['menu', 'experience']);

/**
 * Meal type enum — matches the Dining Mongoose model
 */
export const mealTypeSchema = z.enum([
  'breakfast',
  'lunch',
  'dinner',
  'all-day',
]);

/**
 * Category enum — matches the Dining Mongoose model
 */
export const diningCategorySchema = z.enum([
  'regular',
  'craft-beer',
  'wine',
  'spirits',
  'non-alcoholic',
]);

/**
 * Dietary option enum — matches the Dining Mongoose model
 */
export const dietaryOptionSchema = z.enum([
  'vegetarian',
  'vegan',
  'gluten-free',
  'dairy-free',
  'keto',
  'paleo',
]);

/**
 * Beverage sub-schema — matches the Dining Mongoose model's beverages array
 */
const beverageSchema = z.object({
  name: z.string().min(1, 'Beverage name is required'),
  description: z.string().optional(),
  price: z.number().min(0).optional(),
  alcoholContent: z.number().min(0).optional(),
  category: z.enum(['craft-beer', 'wine', 'spirits', 'non-alcoholic']),
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
export const createDiningSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z
    .string()
    .min(DINING_DESCRIPTION_MIN, 'Description must be at least 10 characters')
    .max(DINING_DESCRIPTION_MAX),
  type: diningTypeSchema,
  mealType: mealTypeSchema,
  category: diningCategorySchema,
  subCategory: z.string().max(50).optional(),
  price: z.number().positive('Price must be positive'),
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
});

/**
 * Update dining item request schema (all fields optional except _id).
 *
 * Deliberately not derived via `.partial()` on the create schema — fields
 * there carry `.default()`, which Zod applies even when the key is absent
 * from a partial update, silently resetting them to create-time defaults.
 */
export const updateDiningSchema = z.object({
  _id: z.string().min(1, 'Dining item ID is required'),
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
  price: z.number().positive().optional(),
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
});

export type CreateDiningInput = z.infer<typeof createDiningSchema>;
export type UpdateDiningInput = z.infer<typeof updateDiningSchema>;
