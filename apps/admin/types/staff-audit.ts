import type {
  IAuditLog,
  AuditAction,
} from '@lodgeflow/database/models/AuditLog';
import type { StaffRole } from '@/lib/permissions';

export interface StaffMemberJson {
  userId?: string;
  name?: string;
  role: StaffRole | null;
}

export type AuditEventJson = Pick<
  IAuditLog,
  | 'organizationId'
  | 'actor'
  | 'actorRole'
  | 'action'
  | 'resourceType'
  | 'resourceId'
  | 'before'
  | 'after'
> & { _id: string; createdAt: string; __v?: number };

export interface AuditHistoryJson {
  events: AuditEventJson[];
  total: number;
  page: number;
  limit: number;
  actions: readonly AuditAction[];
}
