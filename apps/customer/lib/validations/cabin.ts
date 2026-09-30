import { z } from 'zod';

export const cabinIdSchema = z.string().regex(/^[a-f\d]{24}$/i);
