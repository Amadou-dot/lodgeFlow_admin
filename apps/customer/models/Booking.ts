import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IBooking extends Document {
  cabin: mongoose.Types.ObjectId | string;
  customer: mongoose.Types.ObjectId | string;
  checkInDate: Date;
  checkOutDate: Date;
  numNights: number;
  numGuests: number;
  status:
    'unconfirmed' | 'confirmed' | 'checked-in' | 'checked-out' | 'cancelled';
  cabinPrice: number;
  extrasPrice: number;
  totalPrice: number;
  isPaid: boolean;
  paymentMethod: 'cash' | 'card' | 'bank-transfer' | 'online';
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
  refundStatus?:
    'none' | 'pending' | 'processing' | 'partial' | 'full' | 'failed';
  refundAmount?: number;
  refundedAt?: Date;
  paymentConfirmationSentAt?: Date;
  remainingAmount?: number;
  checkInTime?: Date;
  checkOutTime?: Date;
  durationText: string; // virtual
  paymentStatus: 'paid' | 'partial' | 'unpaid'; // virtual
  createdAt: Date;
  updatedAt: Date;
  overlaps(otherCheckIn: Date, otherCheckOut: Date): boolean;
}

export interface IBookingModel extends Model<IBooking> {
  findOverlapping(
    cabinId: string,
    checkIn: Date,
    checkOut: Date,
    excludeId?: string
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
      type: Schema.Types.String,
      required: [true, 'Customer is required'],
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
      min: [1, 'Minimum 1 night required'],
    },
    numGuests: {
      type: Number,
      required: [true, 'Number of guests is required'],
      min: [1, 'At least 1 guest required'],
    },
    status: {
      type: String,
      enum: [
        'unconfirmed',
        'confirmed',
        'checked-in',
        'checked-out',
        'cancelled',
      ],
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
      enum: ['cash', 'card', 'bank-transfer', 'online'],
      default: 'online',
    },
    extras: {
      hasBreakfast: { type: Boolean, default: false },
      breakfastPrice: { type: Number, default: 0 },
      hasPets: { type: Boolean, default: false },
      petFee: { type: Number, default: 0 },
      hasParking: { type: Boolean, default: false },
      parkingFee: { type: Number, default: 0 },
      hasEarlyCheckIn: { type: Boolean, default: false },
      earlyCheckInFee: { type: Number, default: 0 },
      hasLateCheckOut: { type: Boolean, default: false },
      lateCheckOutFee: { type: Number, default: 0 },
    },
    observations: {
      type: String,
      maxlength: [1000, 'Observations cannot exceed 1000 characters'],
    },
    specialRequests: {
      type: [String],
      default: [],
    },
    depositPaid: {
      type: Boolean,
      default: false,
    },
    depositAmount: {
      type: Number,
      default: 0,
      min: [0, 'Deposit amount must be positive'],
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
      enum: ['none', 'pending', 'processing', 'partial', 'full', 'failed'],
      default: 'none',
    },
    refundAmount: {
      type: Number,
      min: [0, 'Refund amount must be positive'],
    },
    refundedAt: {
      type: Date,
    },
    paymentConfirmationSentAt: {
      type: Date,
    },
    remainingAmount: {
      type: Number,
      min: [0, 'Remaining amount must be positive'],
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Auto-compute remainingAmount before saving
BookingSchema.pre('save', function (this: IBooking) {
  this.remainingAmount = this.totalPrice - this.depositAmount;
});

// Virtual: human-readable duration
BookingSchema.virtual('durationText').get(function (this: IBooking) {
  return `${this.numNights} night${this.numNights === 1 ? '' : 's'}`;
});

// Virtual: payment status derived from isPaid and depositPaid
BookingSchema.virtual('paymentStatus').get(function (
  this: IBooking
): 'paid' | 'partial' | 'unpaid' {
  if (this.isPaid) return 'paid';
  if (this.depositPaid) return 'partial';
  return 'unpaid';
});

// Instance method: check if this booking overlaps with a given date range
BookingSchema.methods.overlaps = function (
  this: IBooking,
  otherCheckIn: Date,
  otherCheckOut: Date
): boolean {
  return this.checkInDate < otherCheckOut && this.checkOutDate > otherCheckIn;
};

// Static method: find all non-cancelled bookings that overlap a date range for a cabin
BookingSchema.statics.findOverlapping = async function (
  cabinId: string,
  checkIn: Date,
  checkOut: Date,
  excludeId?: string
): Promise<IBooking[]> {
  const query: mongoose.FilterQuery<IBooking> = {
    cabin: cabinId,
    status: { $ne: 'cancelled' },
    $or: [{ checkInDate: { $lt: checkOut }, checkOutDate: { $gt: checkIn } }],
  };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  return this.find(query);
};

// Indexes for efficient queries
BookingSchema.index({ customer: 1, createdAt: -1 });
BookingSchema.index({ status: 1, checkInDate: 1 });
BookingSchema.index({ checkInDate: 1, checkOutDate: 1 });
BookingSchema.index({ isPaid: 1 });
BookingSchema.index({ checkInDate: 1 });
BookingSchema.index({ checkOutDate: 1 });

// Prevent overlapping bookings for the same cabin
BookingSchema.index(
  { cabin: 1, checkInDate: 1, checkOutDate: 1 },
  {
    partialFilterExpression: {
      status: { $nin: ['cancelled'] },
    },
  }
);

// Prevent model re-compilation in development
const Booking =
  mongoose.models.Booking ||
  mongoose.model<IBooking, IBookingModel>('Booking', BookingSchema);

export default Booking as IBookingModel;
