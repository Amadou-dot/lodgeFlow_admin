import mongoose, { Document, Schema } from 'mongoose';

export interface IExperienceBooking extends Document {
  experience: mongoose.Types.ObjectId | string;
  customer: string; // Clerk user ID
  date: Date;
  timeSlot?: string;
  numParticipants: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  totalPrice: number;
  isPaid: boolean;
  stripePaymentIntentId?: string;
  specialRequests?: string[];
  observations?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ExperienceBookingSchema: Schema = new Schema(
  {
    experience: {
      type: Schema.Types.ObjectId,
      ref: 'Experience',
      required: [true, 'Experience is required'],
    },
    customer: {
      type: Schema.Types.String,
      required: [true, 'Customer is required'],
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
    },
    timeSlot: {
      type: String,
    },
    numParticipants: {
      type: Number,
      required: [true, 'Number of participants is required'],
      min: [1, 'At least 1 participant required'],
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed'],
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
    specialRequests: {
      type: [String],
      default: [],
    },
    observations: {
      type: String,
      maxlength: [1000, 'Observations cannot exceed 1000 characters'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for efficient queries
ExperienceBookingSchema.index({ experience: 1, date: 1 });
ExperienceBookingSchema.index({ customer: 1, createdAt: -1 });
ExperienceBookingSchema.index({ status: 1, date: 1 });

// Prevent model re-compilation in development
const ExperienceBooking =
  mongoose.models.ExperienceBooking ||
  mongoose.model<IExperienceBooking>(
    'ExperienceBooking',
    ExperienceBookingSchema
  );

export default ExperienceBooking;
