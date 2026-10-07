import { z } from 'zod';

/**
 * Address schema
 */
export const customerAddressSchema = z.object({
  street: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  zipCode: z.string().max(20).optional(),
});

/**
 * Emergency contact schema
 */
export const customerEmergencyContactSchema = z.object({
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  name: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  relationship: z.string().max(50).optional(),
});

/**
 * Customer preferences schema
 */
export const customerPreferencesSchema = z.object({
  smokingPreference: z
    .enum(['smoking', 'non-smoking', 'no-preference'])
    .optional(),
  accessibilityNeeds: z.array(z.string()).optional(),
  roomType: z.string().max(50).optional(),
  floorPreference: z.string().max(50).optional(),
  dietaryRestrictions: z.array(z.string()).optional(),
  specialRequests: z.string().max(500).optional(),
});

/**
 * Create customer request schema
 */
export const createCustomerSchema = z
  .object({
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
    address: customerAddressSchema.strict().optional(),
    emergencyContact: customerEmergencyContactSchema.strict().optional(),
    preferences: customerPreferencesSchema.strict().optional(),
  })
  .strict();

/**
 * Update customer request schema
 */
export type CustomerFieldChange<T> =
  { kind: 'unchanged' } | { kind: 'clear' } | { kind: 'set'; value: T };

function fieldChange<T>(value: T | null | undefined): CustomerFieldChange<T> {
  return value === undefined
    ? { kind: 'unchanged' }
    : value === null
      ? { kind: 'clear' }
      : { kind: 'set', value };
}

// Clerk metadata PATCH values retain null as deletion, including nested keys.
// These values are only used inside the explicit change operation at the provider boundary.
const addressPatchSchema = customerAddressSchema
  .extend({
    street: customerAddressSchema.shape.street.unwrap().nullable().optional(),
    city: customerAddressSchema.shape.city.unwrap().nullable().optional(),
    state: customerAddressSchema.shape.state.unwrap().nullable().optional(),
    country: customerAddressSchema.shape.country.unwrap().nullable().optional(),
    zipCode: customerAddressSchema.shape.zipCode.unwrap().nullable().optional(),
  })
  .strict();
const emergencyContactPatchSchema = customerEmergencyContactSchema
  .extend({
    firstName: customerEmergencyContactSchema.shape.firstName
      .unwrap()
      .nullable()
      .optional(),
    lastName: customerEmergencyContactSchema.shape.lastName
      .unwrap()
      .nullable()
      .optional(),
    name: customerEmergencyContactSchema.shape.name
      .unwrap()
      .nullable()
      .optional(),
    phone: customerEmergencyContactSchema.shape.phone
      .unwrap()
      .nullable()
      .optional(),
    relationship: customerEmergencyContactSchema.shape.relationship
      .unwrap()
      .nullable()
      .optional(),
  })
  .strict();
const preferencesPatchSchema = customerPreferencesSchema
  .extend({
    smokingPreference: customerPreferencesSchema.shape.smokingPreference
      .unwrap()
      .nullable()
      .optional(),
    accessibilityNeeds: customerPreferencesSchema.shape.accessibilityNeeds
      .unwrap()
      .nullable()
      .optional(),
    roomType: customerPreferencesSchema.shape.roomType
      .unwrap()
      .nullable()
      .optional(),
    floorPreference: customerPreferencesSchema.shape.floorPreference
      .unwrap()
      .nullable()
      .optional(),
    dietaryRestrictions: customerPreferencesSchema.shape.dietaryRestrictions
      .unwrap()
      .nullable()
      .optional(),
    specialRequests: customerPreferencesSchema.shape.specialRequests
      .unwrap()
      .nullable()
      .optional(),
  })
  .strict();

export const updateCustomerSchema = z
  .object({
    firstName: z.string().max(50).optional(),
    lastName: z.string().max(50).optional(),
    username: z.string().min(3).max(50).optional(),
    nationality: z.string().max(100).nullable().optional(),
    // Updates retain legacy identifiers verbatim, including separators and
    // lengths that predate the creation rule. Guest forms resubmit stored IDs.
    nationalId: z.string().nullable().optional(),
    address: addressPatchSchema.nullable().optional(),
    emergencyContact: emergencyContactPatchSchema.nullable().optional(),
    preferences: preferencesPatchSchema.nullable().optional(),
    // Existing form submissions included these ignored fields. They never update identity, email, phone or password.
    id: z.unknown().optional(),
    email: z.unknown().optional(),
    phone: z.unknown().optional(),
    password: z.unknown().optional(),
  })
  .strict()
  .transform(data => ({
    firstName: data.firstName,
    lastName: data.lastName,
    username: data.username,
    nationality: fieldChange(data.nationality),
    nationalId: fieldChange(data.nationalId),
    address: fieldChange(data.address),
    emergencyContact: fieldChange(data.emergencyContact),
    preferences: fieldChange(data.preferences),
  }));

export type CreateCustomerInput = z.output<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.output<typeof updateCustomerSchema>;
export type UpdateCustomerRequest = z.input<typeof updateCustomerSchema>;
