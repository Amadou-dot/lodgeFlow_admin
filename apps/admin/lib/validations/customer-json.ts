import {
  customerAddressSchema,
  customerEmergencyContactSchema,
  customerPreferencesSchema,
} from './customer-metadata';
import { BOOKING_STATUSES } from '@lodgeflow/database/config';
import { z } from 'zod';

// Read contracts retain legacy values; request validation owns creation limits.
const timestampSchema = z.iso.datetime();

export const customerJsonSchema = z.object({
  id: z.string(),
  username: z.string().nullable(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  name: z.string(),
  email: z.string(),
  phone: z.string().optional(),
  image_url: z.string(),
  has_image: z.boolean(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
  last_sign_in_at: timestampSchema.nullable(),
  last_active_at: timestampSchema,
  banned: z.boolean(),
  locked: z.boolean(),
  lockout_expires_in_seconds: z.number().nullable(),
  nationality: z.string().optional(),
  nationalId: z.string().optional(),
  address: customerAddressSchema.optional(),
  emergencyContact: customerEmergencyContactSchema.optional(),
  preferences: customerPreferencesSchema.optional(),
  totalBookings: z.number(),
  totalSpent: z.number(),
  lastBookingDate: timestampSchema.optional(),
  recentBookings: z
    .array(
      z.object({
        _id: z.string(),
        cabin: z
          .object({ name: z.string(), image: z.string().optional() })
          .optional(),
        checkInDate: timestampSchema,
        checkOutDate: timestampSchema,
        numNights: z.number(),
        status: z.enum(BOOKING_STATUSES),
        totalPrice: z.number(),
      })
    )
    .optional(),
  loyaltyTier: z.enum(['Bronze', 'Silver', 'Gold', 'Diamond']),
  fullAddress: z.string().optional(),
});
