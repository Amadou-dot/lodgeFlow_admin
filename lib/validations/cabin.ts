import { z } from 'zod';

/**
 * Status enum — matches the Cabin Mongoose model
 */
const cabinStatusSchema = z.enum(['active', 'maintenance', 'inactive']);

/**
 * Description length bounds — kept as constants so create/update can't
 * drift apart the way they previously did (create allowed 1000 chars,
 * update allowed 2000, while the Cabin model itself caps at 1000).
 */
const CABIN_DESCRIPTION_MIN = 10;
const CABIN_DESCRIPTION_MAX = 1000;

/**
 * Create cabin request schema
 */
export const createCabinSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(100),
    image: z.string().url('Invalid image URL'),
    images: z.array(z.string().url('Invalid image URL')).optional().default([]),
    status: cabinStatusSchema.optional().default('active'),
    capacity: z.number().int().min(1, 'Capacity must be at least 1').max(20),
    price: z.number().positive('Price must be positive'),
    discount: z.number().min(0).optional().default(0),
    description: z
      .string()
      .min(CABIN_DESCRIPTION_MIN, 'Description must be at least 10 characters')
      .max(CABIN_DESCRIPTION_MAX),
    amenities: z.array(z.string().trim().min(1)).optional().default([]),
    bedrooms: z.number().min(1, 'Bedrooms must be at least 1').optional(),
    bathrooms: z.number().min(1, 'Bathrooms must be at least 1').optional(),
    size: z.number().min(1, 'Size must be at least 1 sq ft').optional(),
    minNights: z
      .number()
      .int()
      .min(1, 'Minimum nights must be at least 1')
      .optional(),
    extraGuestFee: z.number().min(0).optional().default(0),
  })
  .refine(data => !data.discount || data.discount < data.price, {
    message: 'Discount cannot be greater than or equal to the price',
    path: ['discount'],
  });

/**
 * Update cabin request schema (all fields optional except _id).
 *
 * Deliberately not derived via `.partial()` on the create schema — fields
 * there carry `.default()`, which Zod applies even when the key is absent
 * from a partial update, silently resetting them to create-time defaults.
 */
export const updateCabinSchema = z
  .object({
    _id: z.string().min(1, 'Cabin ID is required'),
    name: z.string().min(1).max(100).optional(),
    image: z.string().url('Invalid image URL').optional(),
    images: z.array(z.string().url('Invalid image URL')).optional(),
    status: cabinStatusSchema.optional(),
    capacity: z.number().int().min(1).max(20).optional(),
    price: z.number().positive().optional(),
    discount: z.number().min(0).optional(),
    description: z
      .string()
      .min(CABIN_DESCRIPTION_MIN)
      .max(CABIN_DESCRIPTION_MAX)
      .optional(),
    amenities: z.array(z.string().trim().min(1)).optional(),
    bedrooms: z.number().min(1).optional(),
    bathrooms: z.number().min(1).optional(),
    size: z.number().min(1).optional(),
    minNights: z.number().int().min(1).optional(),
    extraGuestFee: z.number().min(0).optional(),
  })
  .refine(
    data => {
      if (data.discount !== undefined && data.price !== undefined) {
        return data.discount < data.price;
      }
      return true;
    },
    {
      message: 'Discount cannot be greater than or equal to the price',
      path: ['discount'],
    }
  );

export type CreateCabinInput = z.infer<typeof createCabinSchema>;
export type UpdateCabinInput = z.infer<typeof updateCabinSchema>;
