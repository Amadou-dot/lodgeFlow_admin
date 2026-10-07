import { objectRequestSchema } from './object-request';
import { EXPERIENCE_DIFFICULTIES } from '@/lib/config';
import { z } from 'zod';

/**
 * Difficulty enum
 */
export const difficultySchema = z.enum(EXPERIENCE_DIFFICULTIES);

/**
 * Create experience request schema.
 *
 * Accept only catalog fields; provider/database metadata is server-owned.
 */
const createFieldsSchema = z.strictObject({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().min(1, 'Description is required').max(2000),
  duration: z.string().min(1, 'Duration is required').max(50),
  price: z.number().min(0, 'Price cannot be negative'),
  difficulty: difficultySchema,
  category: z.string().min(1, 'Category is required').max(50),
  image: z.string().min(1, 'Image is required').max(2048),
  includes: z.array(z.string()).min(1, 'At least one inclusion is required'),
  available: z
    .array(z.string())
    .min(1, 'At least one availability option is required'),
  ctaText: z.string().min(1, 'Call to action text is required').max(100),
  longDescription: z.string().max(5000).optional(),
  gallery: z.array(z.string()).optional(),
  isPopular: z.boolean().optional().default(false),
  maxParticipants: z.number().int().min(1).max(500).optional(),
  minAge: z.number().int().min(0).max(120).optional(),
  requirements: z.array(z.string()).optional(),
  location: z.string().max(200).optional(),
  highlights: z.array(z.string()).optional(),
  whatToBring: z.array(z.string()).optional(),
  cancellationPolicy: z.string().max(500).optional(),
  seasonality: z.string().max(200).optional(),
  tags: z.array(z.string()).optional(),
  rating: z.number().min(0).max(5).optional(),
  reviewCount: z.number().int().min(0).optional().default(0),
});

/**
 * Update experience request schema (all fields optional except `_id`).
 *
 * Deliberately not derived via `.partial()` on the create schema — fields
 * there carry `.default()`, which Zod applies even when the key is absent
 * from a partial update, silently resetting them to create-time defaults.
 *
 * Callers select editable fields instead of round-tripping metadata.
 */
const updateFieldsSchema = z.strictObject({
  _id: z
    .string()
    .min(1, 'Experience ID is required')
    .regex(/^[a-f\d]{24}$/i, 'Invalid catalog ID'),
  name: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(2000).optional(),
  duration: z.string().min(1).max(50).optional(),
  price: z.number().min(0).optional(),
  difficulty: difficultySchema.optional(),
  category: z.string().min(1).max(50).optional(),
  image: z.string().min(1).max(2048).optional(),
  includes: z.array(z.string()).min(1).optional(),
  available: z.array(z.string()).min(1).optional(),
  ctaText: z.string().min(1).max(100).optional(),
  longDescription: z.string().max(5000).optional(),
  gallery: z.array(z.string()).optional(),
  isPopular: z.boolean().optional(),
  maxParticipants: z.number().int().min(1).max(500).optional(),
  minAge: z.number().int().min(0).max(120).optional(),
  requirements: z.array(z.string()).optional(),
  location: z.string().max(200).optional(),
  highlights: z.array(z.string()).optional(),
  whatToBring: z.array(z.string()).optional(),
  cancellationPolicy: z.string().max(500).optional(),
  seasonality: z.string().max(200).optional(),
  tags: z.array(z.string()).optional(),
  rating: z.number().min(0).max(5).optional(),
  reviewCount: z.number().int().min(0).optional(),
});

export const createExperienceSchema =
  objectRequestSchema.pipe(createFieldsSchema);
export const updateExperienceSchema =
  objectRequestSchema.pipe(updateFieldsSchema);

export type CreateExperienceInput = z.infer<typeof createExperienceSchema>;
export type UpdateExperienceInput = z.infer<typeof updateExperienceSchema>;
