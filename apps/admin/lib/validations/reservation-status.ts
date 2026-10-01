import { z } from 'zod';

// Lifecycle validation needs the current reservation and stays in the shared
// transaction; parsing enums here would change missing/stale response precedence.
export const reservationStatusSchema = z
  .unknown()
  // Zod drops this key even in strict objects; preserve the route's rejection.
  .refine(
    value =>
      !(
        value !== null &&
        typeof value === 'object' &&
        Object.hasOwn(value, '__proto__')
      ),
    { path: ['__proto__'], message: 'Unexpected field' }
  )
  .pipe(z.object({ status: z.string(), expectedStatus: z.string() }).strict());
