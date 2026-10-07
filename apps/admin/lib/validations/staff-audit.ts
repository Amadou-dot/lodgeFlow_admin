import { objectRequestSchema } from './object-request';
import { z } from 'zod';
import { AUDIT_ACTIONS } from '@lodgeflow/database/models/AuditLog';

const staffRoleFieldsSchema = z
  .strictObject({
    userId: z.string().startsWith('user_'),
    role: z.enum(['front_desk', 'manager', 'admin']).nullable(),
  })
  .transform(({ userId, role }) =>
    role === null
      ? { action: 'revoke' as const, userId }
      : { action: 'assign' as const, userId, role }
  );

const date = z
  .string()
  .transform(value => new Date(value))
  .pipe(z.date({ error: 'Invalid date' }))
  .optional();
export const auditQuerySchema = z
  .object({
    page: z.coerce
      .number()
      .int('Invalid pagination')
      .min(1, 'Invalid pagination')
      .max(10000, 'Invalid pagination'),
    limit: z.coerce
      .number()
      .int('Invalid pagination')
      .min(1, 'Invalid pagination')
      .max(100, 'Invalid pagination'),
    actor: z.string().max(150, 'Invalid filter').optional(),
    resourceId: z.string().max(150, 'Invalid filter').optional(),
    action: z.enum(AUDIT_ACTIONS, { error: 'Invalid action' }).optional(),
    from: date,
    to: date,
  })
  .superRefine((value, context) => {
    if (value.from && value.to && value.from > value.to)
      context.addIssue({
        code: 'custom',
        path: ['to'],
        message: 'Invalid date range',
      });
  });

export function parseAuditQuery(params: URLSearchParams) {
  return auditQuerySchema.safeParse({
    page: params.get('page') ?? '1',
    limit: params.get('limit') ?? '25',
    actor: params.get('actor') || undefined,
    resourceId: params.get('resourceId') || undefined,
    action: params.get('action') || undefined,
    from: params.get('from') || undefined,
    to: params.get('to') || undefined,
  });
}

export const staffRoleRequestSchema = objectRequestSchema.pipe(
  staffRoleFieldsSchema
);
