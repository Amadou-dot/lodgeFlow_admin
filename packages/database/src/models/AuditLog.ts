import mongoose, { Schema, type Document, type Model } from 'mongoose';
export const AUDIT_ACTIONS = [
  'booking.create',
  'booking.update',
  'booking.status_change',
  'booking.cancel',
  'booking.reprice',
  'booking.delete',
  'payment.record',
  'refund.record',
  'dining_reservation.status_change',
  'experience_booking.status_change',
  'cabin.create',
  'cabin.update',
  'cabin.delete',
  'settings.update',
  'staff.role_change',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];
export interface IAuditLog extends Document {
  organizationId: string;
  actor: string;
  actorRole: 'front_desk' | 'manager' | 'admin';
  action: AuditAction;
  resourceType:
    | 'booking'
    | 'dining_reservation'
    | 'experience_booking'
    | 'cabin'
    | 'settings'
    | 'staff';
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
      enum: [
        'booking',
        'dining_reservation',
        'experience_booking',
        'cabin',
        'settings',
        'staff',
      ],
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
