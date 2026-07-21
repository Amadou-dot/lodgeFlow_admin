import mongoose, { Document, Schema } from 'mongoose';

export interface ICabinBookingLock extends Document {
  cabin: mongoose.Types.ObjectId;
  token: string;
  expiresAt: Date;
}

const CabinBookingLockSchema: Schema = new Schema(
  {
    cabin: {
      type: Schema.Types.ObjectId,
      ref: 'Cabin',
      required: true,
      unique: true,
    },
    token: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: false,
  }
);

// Backstop cleanup for orphaned locks (e.g. a cabin that's later deleted
// while its lock document lingers). The lock's own acquire logic already
// reclaims expired locks on the next contended request for that cabin;
// this just guarantees eventual cleanup even if no such request ever
// comes, mirroring the ProcessedStripeEvent TTL pattern.
CabinBookingLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const CabinBookingLock =
  mongoose.models.CabinBookingLock ||
  mongoose.model<ICabinBookingLock>('CabinBookingLock', CabinBookingLockSchema);

export default CabinBookingLock;
