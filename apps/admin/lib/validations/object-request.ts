import { z } from 'zod';

// Strict object schemas discard __proto__ before reporting unknown keys. Reject
// an explicit transport key before the field schema processes the object.
export const objectRequestSchema = z
  .unknown()
  .refine(
    value =>
      !(
        value !== null &&
        typeof value === 'object' &&
        Object.hasOwn(value, '__proto__')
      ),
    { path: ['__proto__'], message: 'Unexpected field' }
  );
