import mongoose, { Document, Schema } from 'mongoose';

export interface IDiningReservation extends Document {
  dining: mongoose.Types.ObjectId | string;
  customer: string; // Clerk user ID
  date: Date;
  time: string; // HH:MM format
  numGuests: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no-show';
  totalPrice: number;
  isPaid: boolean;
  stripePaymentIntentId?: string;
  dietaryRequirements?: string[];
  specialRequests?: string[];
  tablePreference?: 'indoor' | 'outdoor' | 'bar' | 'no-preference';
  occasion?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DiningReservationSchema: Schema = new Schema(
  {
    dining: {
      type: Schema.Types.ObjectId,
      ref: 'Dining',
      required: [true, 'Dining item is required'],
    },
    customer: {
      type: Schema.Types.String,
      required: [true, 'Customer is required'],
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
    },
    time: {
      type: String,
      required: [true, 'Time is required'],
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:MM format'],
    },
    numGuests: {
      type: Number,
      required: [true, 'Number of guests is required'],
      min: [1, 'At least 1 guest required'],
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed', 'no-show'],
      default: 'pending',
    },
    totalPrice: {
      type: Number,
      required: [true, 'Total price is required'],
      min: [0, 'Total price must be positive'],
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    stripePaymentIntentId: {
      type: String,
    },
    dietaryRequirements: {
      type: [String],
      default: [],
    },
    specialRequests: {
      type: [String],
      default: [],
    },
    tablePreference: {
      type: String,
      enum: ['indoor', 'outdoor', 'bar', 'no-preference'],
      default: 'no-preference',
    },
    occasion: {
      type: String,
      maxlength: [200, 'Occasion cannot exceed 200 characters'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for efficient queries
DiningReservationSchema.index({ dining: 1, date: 1, time: 1 });
DiningReservationSchema.index({ customer: 1, createdAt: -1 });
DiningReservationSchema.index({ status: 1, date: 1 });

// Prevent model re-compilation in development
const DiningReservation =
  mongoose.models.DiningReservation ||
  mongoose.model<IDiningReservation>(
    'DiningReservation',
    DiningReservationSchema
  );

export default DiningReservation;
