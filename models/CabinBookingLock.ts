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

const CabinBookingLock =
  mongoose.models.CabinBookingLock ||
  mongoose.model<ICabinBookingLock>(
    'CabinBookingLock',
    CabinBookingLockSchema
  );

export default CabinBookingLock;
