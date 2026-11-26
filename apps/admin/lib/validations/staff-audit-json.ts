import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
} from '@lodgeflow/database/config';
import { z } from 'zod';
import { isStaffRole, PERMISSIONS, type StaffRole } from '@/lib/permissions';

const role = z.custom<StaffRole>(isStaffRole);
const userId = z.string().min(1);

export const staffAccessJsonSchema = z.object({
  userId,
  role,
  permissions: z.array(z.enum(PERMISSIONS)).readonly(),
});

export const staffMemberJsonSchema = z.object({
  userId: userId.optional(),
  name: z.string().optional(),
  role: role.nullable(),
});

export const staffRosterJsonSchema = z.array(staffMemberJsonSchema);

export const staffRoleChangeJsonSchema = z.object({
  userId,
  role: role.nullable(),
});

const action = z.enum(AUDIT_ACTIONS);
const snapshot = z.record(z.string(), z.unknown());
// The serializer emits canonical Date.toISOString() strings, including signed years.
const timestamp = z.string().refine(value => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
});

export const auditEventJsonSchema = z.object({
  _id: z.string().regex(/^[a-f0-9]{24}$/),
  organizationId: z.string().min(1),
  actor: z.string().min(1),
  actorRole: role,
  action,
  resourceType: z.enum(AUDIT_RESOURCE_TYPES),
  resourceId: z.string().min(1),
  before: snapshot,
  after: snapshot,
  createdAt: timestamp,
  __v: z.number().optional(),
});

export const auditHistoryJsonSchema = z.object({
  events: z.array(auditEventJsonSchema),
  total: z.int().nonnegative(),
  page: z.int().positive(),
  limit: z.int().positive(),
  actions: z.array(action).readonly(),
});

const successJsonSchema = z.object({
  success: z.literal(true),
  data: z.unknown(),
});

const errorJsonSchema = z.object({
  success: z.literal(false).optional(),
  error: z.string().min(1),
});

function isStaffAuditJson<T>(
  value: unknown,
  schema: z.ZodType<T, T>
): value is T {
  // Keep the original JSON so newer producers can add fields at any depth.
  return schema.safeParse(value).success;
}

export async function readStaffAuditResponse<T>({
  response,
  schema,
  fallback,
}: {
  response: Response;
  schema: z.ZodType<T, T>;
  fallback: string;
}): Promise<T> {
  const body: unknown = await response.json().catch(() => undefined);
  const result = successJsonSchema.safeParse(body);
  if (
    response.ok &&
    result.success &&
    isStaffAuditJson(result.data.data, schema)
  )
    return result.data.data;

  const failure = errorJsonSchema.safeParse(body);
  throw new Error(failure.success ? failure.data.error : fallback);
}
