import { objectRequestSchema } from './object-request';
import { z } from 'zod';

const receiptFieldsSchema = z
  .object({
    id: z.uuid(),
    type: z.enum(['payment', 'refund']),
    amountCents: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    method: z.enum(['cash', 'bank_transfer', 'card', 'stripe']),
    reference: z.string().trim().max(200),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.method === 'stripe' && value.type !== 'refund')
      context.addIssue({
        code: 'custom',
        message: 'Use customer checkout to collect online payments',
      });
    if (
      (value.method !== 'cash' || value.type === 'refund') &&
      !value.reference
    )
      context.addIssue({
        code: 'custom',
        path: ['reference'],
        message: 'Provide a receipt reference or refund reason',
      });
  });

export const reservationReceiptSchema =
  objectRequestSchema.pipe(receiptFieldsSchema);
