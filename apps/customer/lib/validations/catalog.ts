import { z } from 'zod';

export const catalogIdSchema = z.string().regex(/^[a-f\d]{24}$/i);
