import { z } from 'zod';

export const customerLockSuccessResponseSchema = z.object({
  success: z.literal(true),
  message: z.string().optional(),
  data: z.object({
    locked: z.literal(true),
    lockedAt: z.iso.datetime(),
  }),
});

export const customerUnlockSuccessResponseSchema = z.object({
  success: z.literal(true),
  message: z.string().optional(),
  data: z.object({
    locked: z.literal(false),
    unlockedAt: z.iso.datetime(),
  }),
});

// Preserve error-only HTTP replies as well as the standard error envelope.
export const customerLockErrorSchema = z.object({ error: z.string().min(1) });
