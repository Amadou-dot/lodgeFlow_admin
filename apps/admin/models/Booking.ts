import {
  BOOKING_STATUSES,
  PAYMENT_METHODS,
  REFUND_STATUSES,
} from '@/lib/config';
import { differenceInCalendarDays } from 'date-fns';
import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IBooking extends Document {
  cabin: mongoose.Types.ObjectId;
  customer: string; // Changed to string to store Clerk user ID
  checkInDate: Date;
  checkOutDate: Date;
  numNights: number;
  numGuests: number;
  status: (typeof BOOKING_STATUSES)[number];
  cabinPrice: number;
  extrasPrice: number;
  totalPrice: number;
  isPaid: boolean;
  paymentMethod?: (typeof PAYMENT_METHODS)[number];
  extras: {
    hasBreakfast: boolean;
    breakfastPrice: number;
    hasPets: boolean;
    petFee: number;
    hasParking: boolean;
    parkingFee: number;
    hasEarlyCheckIn: boolean;
    earlyCheckInFee: number;
    hasLateCheckOut: boolean;
    lateCheckOutFee: number;
  };
  observations?: string;
  specialRequests?: string[];
  depositPaid: boolean;
  depositAmount: number;
  stripePaymentIntentId?: string;
  stripeSessionId?: string;
  paidAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  refundStatus: (typeof REFUND_STATUSES)[number];
  refundAmount?: number;
  refundedAt?: Date;
  paymentConfirmationSentAt?: Date;
  remainingAmount: number;
  checkInTime?: Date;
  checkOutTime?: Date;
  readonly durationText?: string;
  readonly paymentStatus?: 'paid' | 'partial' | 'unpaid';
  createdAt: Date;
  updatedAt: Date;
  overlaps(otherCheckIn: Date, otherCheckOut: Date): boolean;
}

export interface IBookingModel extends Model<IBooking> {
  findOverlapping(
    cabinId: mongoose.Types.ObjectId | string,
    checkInDate: Date,
    checkOutDate: Date,
    excludeBookingId?: mongoose.Types.ObjectId | string
  ): Promise<IBooking[]>;
}

const BookingSchema: Schema = new Schema(
  {
    cabin: {
      type: Schema.Types.ObjectId,
      ref: 'Cabin',
      required: [true, 'Cabin is required'],
    },
    customer: {
      type: String,
      required: [true, 'Customer is required'],
      trim: true,
    },
    checkInDate: {
      type: Date,
      required: [true, 'Check-in date is required'],
    },
    checkOutDate: {
      type: Date,
      required: [true, 'Check-out date is required'],
      validate: {
        validator: function (this: IBooking, checkOutDate: Date) {
          return checkOutDate > this.checkInDate;
        },
        message: 'Check-out date must be after check-in date',
      },
    },
    numNights: {
      type: Number,
      required: [true, 'Number of nights is required'],
      min: [1, 'Number of nights must be at least 1'],
    },
    numGuests: {
      type: Number,
      required: [true, 'Number of guests is required'],
      min: [1, 'Number of guests must be at least 1'],
    },
    status: {
      type: String,
      enum: [...BOOKING_STATUSES],
      default: 'unconfirmed',
    },
    cabinPrice: {
      type: Number,
      required: [true, 'Cabin price is required'],
      min: [0, 'Cabin price must be positive'],
    },
    extrasPrice: {
      type: Number,
      default: 0,
      min: [0, 'Extras price must be positive'],
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
    paymentMethod: {
      type: String,
      enum: [...PAYMENT_METHODS],
      default: 'online',
    },
    extras: {
      hasBreakfast: { type: Boolean, default: false },
      breakfastPrice: { type: Number, default: 0, min: 0 },
      hasPets: { type: Boolean, default: false },
      petFee: { type: Number, default: 0, min: 0 },
      hasParking: { type: Boolean, default: false },
      parkingFee: { type: Number, default: 0, min: 0 },
      hasEarlyCheckIn: { type: Boolean, default: false },
      earlyCheckInFee: { type: Number, default: 0, min: 0 },
      hasLateCheckOut: { type: Boolean, default: false },
      lateCheckOutFee: { type: Number, default: 0, min: 0 },
    },
    observations: {
      type: String,
      trim: true,
      maxlength: [1000, 'Observations cannot exceed 1000 characters'],
    },
    specialRequests: [
      {
        type: String,
        trim: true,
      },
    ],
    depositPaid: {
      type: Boolean,
      default: false,
    },
    depositAmount: {
      type: Number,
      default: 0,
      min: [0, 'Deposit amount cannot be negative'],
    },
    stripePaymentIntentId: {
      type: String,
    },
    stripeSessionId: {
      type: String,
    },
    paidAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    cancellationReason: {
      type: String,
      maxlength: [500, 'Cancellation reason cannot exceed 500 characters'],
    },
    refundStatus: {
      type: String,
      enum: [...REFUND_STATUSES],
      default: 'none',
    },
    refundAmount: {
      type: Number,
      min: [0, 'Refund amount cannot be negative'],
    },
    refundedAt: {
      type: Date,
    },
    paymentConfirmationSentAt: {
      type: Date,
    },
    remainingAmount: {
      type: Number,
      default: 0,
      min: [0, 'Remaining amount cannot be negative'],
    },
    checkInTime: {
      type: Date,
    },
    checkOutTime: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
BookingSchema.index({ cabin: 1, checkInDate: 1, checkOutDate: 1 });
BookingSchema.index({ customer: 1, createdAt: -1 });
BookingSchema.index({ status: 1 });
BookingSchema.index({ checkInDate: 1 });
BookingSchema.index({ checkOutDate: 1 });
BookingSchema.index({ isPaid: 1 });

// Compound index for date range queries
BookingSchema.index({ checkInDate: 1, checkOutDate: 1 });

// Pre-save middleware to calculate numNights and remainingAmount
BookingSchema.pre('save', function (this: IBooking, next) {
  if (
    this.isNew ||
    this.isModified('checkInDate') ||
    this.isModified('checkOutDate')
  ) {
    if (this.checkInDate && this.checkOutDate) {
      this.numNights = differenceInCalendarDays(
        this.checkOutDate,
        this.checkInDate
      );
    }
  }

  if (
    this.isNew ||
    this.isModified('totalPrice') ||
    this.isModified('depositAmount')
  ) {
    // Calculate remaining amount (clamped to 0 for overpayment scenarios)
    this.remainingAmount = Math.max(0, this.totalPrice - this.depositAmount);
  }

  next();
});

// Method to check if booking dates overlap with another booking
BookingSchema.methods.overlaps = function (
  this: IBooking,
  otherCheckIn: Date,
  otherCheckOut: Date
) {
  return this.checkInDate < otherCheckOut && this.checkOutDate > otherCheckIn;
};

// Static method to find overlapping bookings
BookingSchema.statics.findOverlapping = async function (
  cabinId: mongoose.Types.ObjectId | string,
  checkInDate: Date,
  checkOutDate: Date,
  excludeBookingId?: mongoose.Types.ObjectId | string
): Promise<IBooking[]> {
  const query: mongoose.FilterQuery<IBooking> = {
    cabin: cabinId,
    status: { $ne: 'cancelled' },
    $or: [
      {
        checkInDate: { $lt: checkOutDate },
        checkOutDate: { $gt: checkInDate },
      },
    ],
  };

  if (excludeBookingId) {
    query._id = {
      $ne: new mongoose.Types.ObjectId(excludeBookingId.toString()),
    };
  }

  return this.find(query);
};

// Virtual for booking duration in a readable format
BookingSchema.virtual('durationText').get(function (this: IBooking) {
  return `${this.numNights} night${this.numNights > 1 ? 's' : ''}`;
});

// Virtual for payment status
BookingSchema.virtual('paymentStatus').get(function (this: IBooking) {
  if (this.isPaid) return 'paid';
  if (this.depositPaid) return 'partial';
  return 'unpaid';
});

// Ensure virtual fields are serialized
BookingSchema.set('toJSON', { virtuals: true });
BookingSchema.set('toObject', { virtuals: true });

const Booking: IBookingModel =
  (mongoose.models.Booking as IBookingModel) ||
  mongoose.model<IBooking, IBookingModel>('Booking', BookingSchema);

export default Booking;
