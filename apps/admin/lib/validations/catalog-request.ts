import { z } from 'zod';

export const catalogIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid catalog ID');

/** The path owns identity; malformed non-object bodies must remain invalid. */
export function withCatalogPathId({
  body,
  id,
}: {
  body: unknown;
  id: string;
}): unknown {
  if (typeof body !== 'object' || body === null || Array.isArray(body))
    return body;
  if (Object.hasOwn(body, '__proto__')) return body;
  return { ...body, _id: id };
}
