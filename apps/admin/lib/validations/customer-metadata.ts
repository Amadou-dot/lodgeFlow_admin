import { z } from 'zod';

// Reads retain partial legacy profiles; creation requirements belong to request schemas.
export const customerAddressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  zipCode: z.string().optional(),
});
export const customerEmergencyContactSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  name: z.string().optional(),
  phone: z.string().optional(),
  relationship: z.string().optional(),
});
export const customerPreferencesSchema = z.object({
  smokingPreference: z
    .enum(['smoking', 'non-smoking', 'no-preference'])
    .optional(),
  dietaryRestrictions: z.array(z.string()).optional(),
  accessibilityNeeds: z.array(z.string()).optional(),
  roomType: z.string().optional(),
  floorPreference: z.string().optional(),
  specialRequests: z.string().optional(),
});
