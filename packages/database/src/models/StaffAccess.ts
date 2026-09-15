import mongoose, { Schema, type Document, type Model } from 'mongoose';

export const STAFF_ROLES = ['front_desk', 'manager', 'admin'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export interface IStaffAccess extends Document {
  organizationId: string;
  userId: string;
  role: StaffRole;
  updatedBy: string;
  revision: number;
}
const schema = new Schema<IStaffAccess>(
  {
    organizationId: { type: String, required: true },
    userId: { type: String, required: true },
    role: { type: String, enum: STAFF_ROLES, required: true },
    revision: { type: Number, default: 0 },
    updatedBy: { type: String, required: true },
  },
  { timestamps: true }
);
schema.index({ organizationId: 1, userId: 1 }, { unique: true });
const StaffAccess: Model<IStaffAccess> =
  mongoose.models.StaffAccess ||
  mongoose.model<IStaffAccess>('StaffAccess', schema);
export default StaffAccess;
