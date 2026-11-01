import { z } from 'zod';
import { customerJsonSchema } from './customer-json';

// Redis stores JSON timestamps; only validated strings become server-side Dates.
const dateSchema = z.iso.datetime().transform(value => new Date(value));
const cachedCustomerSchema = customerJsonSchema.extend({
  created_at: dateSchema,
  updated_at: dateSchema,
  last_sign_in_at: dateSchema.nullable(),
  last_active_at: dateSchema,
  lastBookingDate: dateSchema.optional(),
});

// A present null payload is a deleted-user hit; a missing Redis key is a miss.
export const customerCacheEntrySchema = z.object({
  data: cachedCustomerSchema.nullable(),
});
