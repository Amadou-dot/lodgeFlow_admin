import { BOOKING_STATUSES } from '@lodgeflow/database/config';
import { z } from 'zod';

// Redis stores JSON timestamps; only validated strings become server-side Dates.
const timestampSchema = z.iso.datetime();
const dateSchema = timestampSchema.transform(value => new Date(value));

const cachedCustomerSchema = z.object({
  id: z.string(),
  username: z.string().nullable(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  name: z.string(),
  email: z.string(),
  phone: z.string().optional(),
  image_url: z.string(),
  has_image: z.boolean(),
  created_at: dateSchema,
  updated_at: dateSchema,
  last_sign_in_at: dateSchema.nullable(),
  last_active_at: dateSchema,
  banned: z.boolean(),
  locked: z.boolean(),
  lockout_expires_in_seconds: z.number().nullable(),
  nationality: z.string().optional(),
  nationalId: z.string().optional(),
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      zipCode: z.string().optional(),
    })
    .optional(),
  emergencyContact: z
    .object({
      firstName: z.string(),
      lastName: z.string(),
      phone: z.string(),
      relationship: z.string(),
    })
    .optional(),
  preferences: z
    .object({
      smokingPreference: z.enum(['smoking', 'non-smoking', 'no-preference']),
      dietaryRestrictions: z.array(z.string()).optional(),
      accessibilityNeeds: z.array(z.string()).optional(),
    })
    .optional(),
  totalBookings: z.number(),
  totalSpent: z.number(),
  lastBookingDate: dateSchema.optional(),
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

// A present null payload is a deleted-user hit; a missing Redis key is a miss.
export const customerCacheEntrySchema = z.object({
  data: cachedCustomerSchema.nullable(),
});
