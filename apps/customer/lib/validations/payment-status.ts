import { z } from 'zod';

export const paymentStatusParamsSchema = z.object({
  bookingId: z.string().regex(/^[a-f\d]{24}$/i),
});
