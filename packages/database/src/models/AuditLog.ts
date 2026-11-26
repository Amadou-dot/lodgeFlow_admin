import mongoose, { Schema, type Document, type Model } from 'mongoose';
import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
  type AuditAction,
  type AuditResourceType,
} from '../config';

export { AUDIT_ACTIONS, type AuditAction } from '../config';

export interface IAuditLog extends Document {
  organizationId: string;
  actor: string;
  actorRole: 'front_desk' | 'manager' | 'admin';
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  createdAt: Date;
}
const schema = new Schema<IAuditLog>(
  {
    organizationId: { type: String, required: true, immutable: true },
    actor: { type: String, required: true, immutable: true },
    actorRole: {
      type: String,
      required: true,
      enum: ['front_desk', 'manager', 'admin'],
      immutable: true,
    },
    action: {
      type: String,
      required: true,
      enum: AUDIT_ACTIONS,
      immutable: true,
    },
    resourceType: {
      type: String,
      required: true,
      enum: AUDIT_RESOURCE_TYPES,
      immutable: true,
    },
    resourceId: { type: String, required: true, immutable: true },
    before: { type: Schema.Types.Mixed, default: {}, immutable: true },
    after: { type: Schema.Types.Mixed, default: {}, immutable: true },
    createdAt: { type: Date, default: Date.now, immutable: true },
  },
  { minimize: false }
);
schema.index({ organizationId: 1, createdAt: -1, _id: -1 });
schema.index({ organizationId: 1, actor: 1, createdAt: -1 });
schema.index({ organizationId: 1, resourceId: 1, createdAt: -1 });
const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', schema);
export default AuditLog;
