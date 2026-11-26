import { settingsJsonSchema } from '@lodgeflow/database/settings-json-schema';
import { z } from 'zod';

export const settingsResponseSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    data: settingsJsonSchema,
  }),
  z.object({
    success: z.literal(false),
    error: z.string().min(1),
  }),
]);
