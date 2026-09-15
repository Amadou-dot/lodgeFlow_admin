import { z } from 'zod';

/**
 * Address schema
 */
const addressSchema = z.object({
  street: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  zipCode: z.string().max(20).optional(),
});

/**
 * Emergency contact schema
 */
const emergencyContactSchema = z.object({
  name: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  relationship: z.string().max(50).optional(),
});

/**
 * Customer preferences schema
 */
const preferencesSchema = z.object({
  roomType: z.string().max(50).optional(),
  floorPreference: z.string().max(50).optional(),
  dietaryRestrictions: z.array(z.string()).optional(),
  specialRequests: z.string().max(500).optional(),
});

/**
 * Create customer request schema
 */
export const createCustomerSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  email: z.string().email('Invalid email address'),
  phone: z.string().max(20).optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  nationality: z.string().max(100).optional(),
  nationalId: z
    .string()
    .regex(
      /^[A-Za-z0-9]{5,20}$/,
      'National ID must be 5-20 alphanumeric characters'
    )
    .optional(),
  address: addressSchema.optional(),
  emergencyContact: emergencyContactSchema.optional(),
  preferences: preferencesSchema.optional(),
});

/**
 * Update customer request schema
 */
export const updateCustomerSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  username: z.string().min(3).max(50).optional(),
  nationality: z.string().max(100).optional(),
  nationalId: z
    .string()
    .regex(/^[A-Za-z0-9]{5,20}$/)
    .optional(),
  address: addressSchema.optional(),
  emergencyContact: emergencyContactSchema.optional(),
  preferences: preferencesSchema.optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
