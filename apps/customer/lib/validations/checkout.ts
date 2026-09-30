import { z } from 'zod';

export const createCheckoutSchema = z.object({
  bookingId: z.string().regex(/^[a-f\d]{24}$/i),
});

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;
