import { z } from 'zod';

const REQUIRED_FIELDS = 'action and ids (non-empty array) are required';
const INVALID_DATA = 'Invalid bulk operation data';
const INVALID_IDS = 'Each id must be a valid ObjectId string';
const MAX_BULK_ITEMS = 50;

const idsSchema = z
  .array(z.string().regex(/^[a-f0-9]{24}$/i))
  .min(1)
  .max(MAX_BULK_ITEMS);

export const bulkCabinSchema = z
  .unknown()
  // Zod drops this key even in strict objects; reject it at the boundary.
  .refine(
    value =>
      !(
        value !== null &&
        typeof value === 'object' &&
        Object.hasOwn(value, '__proto__')
      )
  )
  .pipe(
    z.discriminatedUnion('action', [
      z.object({ action: z.literal('delete'), ids: idsSchema }).strict(),
      z
        .object({
          action: z.literal('update-discount'),
          ids: idsSchema,
          discount: z.number().nonnegative(),
        })
        .strict(),
    ])
  );

export type BulkCabinInput = z.output<typeof bulkCabinSchema>;

// Preserve legacy error precedence: required fields, ID format, count, action,
// then discount. Only the complete schema's output reaches the operation.
const envelopeSchema = z.object({
  action: z.unknown().refine(Boolean),
  ids: z.array(z.unknown()).min(1),
  discount: z.unknown().optional(),
});

type BulkCabinRequest =
  { success: true; data: BulkCabinInput } | { success: false; error: string };

export async function readBulkCabinRequest(
  request: Request
): Promise<BulkCabinRequest> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { success: false, error: INVALID_DATA };
  }

  const parsed = bulkCabinSchema.safeParse(body);
  if (parsed.success) return { success: true, data: parsed.data };

  const envelope = envelopeSchema.safeParse(body);
  if (!envelope.success) {
    return {
      success: false,
      error: envelope.error.issues.some(issue => issue.path.length === 0)
        ? INVALID_DATA
        : REQUIRED_FIELDS,
    };
  }
  const ids = idsSchema.safeParse(envelope.data.ids);
  if (!ids.success) {
    return {
      success: false,
      error: ids.error.issues.some(issue => issue.path.length > 0)
        ? INVALID_IDS
        : `Cannot process more than ${MAX_BULK_ITEMS} items at once`,
    };
  }
  const { action, discount } = envelope.data;
  if (
    typeof action === 'string' &&
    action !== 'delete' &&
    action !== 'update-discount'
  ) {
    return { success: false, error: `Unknown action: ${action}` };
  }
  if (action === 'update-discount') {
    if (typeof discount !== 'number') {
      return { success: false, error: 'discount (number) is required' };
    }
    if (Number.isFinite(discount) && discount < 0) {
      return {
        success: false,
        error: 'Discount must be a non-negative number',
      };
    }
  }
  return { success: false, error: INVALID_DATA };
}
