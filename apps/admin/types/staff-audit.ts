import type { z } from 'zod';
import type {
  auditEventJsonSchema,
  auditHistoryJsonSchema,
  staffAccessJsonSchema,
  staffMemberJsonSchema,
  staffRoleChangeJsonSchema,
} from '@/lib/validations/staff-audit-json';

export type StaffAccessJson = z.infer<typeof staffAccessJsonSchema>;
export type StaffMemberJson = z.infer<typeof staffMemberJsonSchema>;
export type StaffRoleChangeJson = z.infer<typeof staffRoleChangeJsonSchema>;
export type AuditEventJson = z.infer<typeof auditEventJsonSchema>;
export type AuditHistoryJson = z.infer<typeof auditHistoryJsonSchema>;
