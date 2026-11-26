import { settingsJsonSchema } from '@lodgeflow/database/settings-json-schema';
import { z } from 'zod';

export const settingsSuccessResponseSchema = z.object({
  success: z.literal(true),
  data: settingsJsonSchema,
});

export const settingsFailureSchema = z.object({
  success: z.literal(false),
  error: z.string().min(1),
});

export const settingsUpdateHttpFailureSchema = settingsFailureSchema.partial({
  success: true,
});
