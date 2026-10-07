import type { Types } from 'mongoose';
import type { AuditEventJson } from '@/types/staff-audit';

type AuditEventSource = Omit<AuditEventJson, '_id' | 'createdAt'> & {
  _id: Types.ObjectId;
  createdAt: Date;
};

export function serializeAuditEvent(event: AuditEventSource): AuditEventJson {
  return {
    _id: event._id.toHexString(),
    organizationId: event.organizationId,
    actor: event.actor,
    actorRole: event.actorRole,
    action: event.action,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    before: event.before,
    after: event.after,
    createdAt: event.createdAt.toISOString(),
    __v: event.__v,
  };
}
