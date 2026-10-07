import { z } from 'zod';
export const reservationIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid reservation ID');
