import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ISettings extends Document {
  minBookingLength: number;
  maxBookingLength: number;
  maxGuestsPerBooking: number;
  breakfastPrice: number;
  checkInTime: string;
  checkOutTime: string;
  cancellationPolicy: 'flexible' | 'moderate' | 'strict';
  requireDeposit: boolean;
  depositPercentage: number;
  allowPets: boolean;
  petFee: number;
  smokingAllowed: boolean;
  earlyCheckInFee: number;
  lateCheckOutFee: number;
  wifiIncluded: boolean;
  parkingIncluded: boolean;
  parkingFee: number;
  currency: string;
  timezone: string;
  businessHours?: {
    open: string;
    close: string;
    daysOpen: string[];
  };
  contactInfo?: {
    phone?: string;
    email?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      country?: string;
      zipCode?: string;
    };
  };
  notifications?: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    bookingConfirmation: boolean;
    paymentReminders: boolean;
    checkInReminders: boolean;
  };
  fullAddress: string; // virtual
  createdAt: Date;
  updatedAt: Date;
}

export interface ISettingsModel extends Model<ISettings> {
  getSettings(): Promise<ISettings>;
}

const SettingsSchema: Schema = new Schema(
  {
    minBookingLength: {
      type: Number,
      required: [true, 'Minimum booking length is required'],
      min: [1, 'Minimum booking length must be at least 1 night'],
      default: 2,
    },
    maxBookingLength: {
      type: Number,
      required: [true, 'Maximum booking length is required'],
      min: [1, 'Maximum booking length must be at least 1 night'],
      default: 30,
    },
    maxGuestsPerBooking: {
      type: Number,
      required: [true, 'Maximum guests per booking is required'],
      min: [1, 'Maximum guests must be at least 1'],
      default: 8,
    },
    breakfastPrice: {
      type: Number,
      required: [true, 'Breakfast price is required'],
      min: [0, 'Breakfast price must be positive'],
      default: 15,
    },
    checkInTime: {
      type: String,
      required: [true, 'Check-in time is required'],
      match: [
        /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
        'Check-in time must be in HH:MM format',
      ],
      default: '15:00',
    },
    checkOutTime: {
      type: String,
      required: [true, 'Check-out time is required'],
      match: [
        /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
        'Check-out time must be in HH:MM format',
      ],
      default: '11:00',
    },
    cancellationPolicy: {
      type: String,
      enum: ['flexible', 'moderate', 'strict'],
      default: 'moderate',
    },
    requireDeposit: {
      type: Boolean,
      default: true,
    },
    depositPercentage: {
      type: Number,
      min: [0, 'Deposit percentage must be positive'],
      max: [100, 'Deposit percentage cannot exceed 100%'],
      default: 25,
    },
    allowPets: {
      type: Boolean,
      default: true,
    },
    petFee: {
      type: Number,
      min: [0, 'Pet fee must be positive'],
      default: 20,
    },
    smokingAllowed: {
      type: Boolean,
      default: false,
    },
    earlyCheckInFee: {
      type: Number,
      min: [0, 'Early check-in fee must be positive'],
      default: 50,
    },
    lateCheckOutFee: {
      type: Number,
      min: [0, 'Late check-out fee must be positive'],
      default: 50,
    },
    wifiIncluded: {
      type: Boolean,
      default: true,
    },
    parkingIncluded: {
      type: Boolean,
      default: false,
    },
    parkingFee: {
      type: Number,
      min: [0, 'Parking fee must be positive'],
      default: 10,
    },
    currency: {
      type: String,
      required: [true, 'Currency is required'],
      default: 'USD',
      maxlength: [3, 'Currency code cannot exceed 3 characters'],
    },
    timezone: {
      type: String,
      required: [true, 'Timezone is required'],
      default: 'UTC',
    },
    businessHours: {
      open: { type: String },
      close: { type: String },
      daysOpen: {
        type: [String],
        enum: [
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
          'Sunday',
          'monday',
          'tuesday',
          'wednesday',
          'thursday',
          'friday',
          'saturday',
          'sunday',
        ],
      },
    },
    contactInfo: {
      phone: {
        type: String,
        match: [
          /^\+?[\d\s\-().]{7,20}$/,
          'Please provide a valid phone number',
        ],
      },
      email: {
        type: String,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email'],
      },
      address: {
        street: { type: String },
        city: { type: String },
        state: { type: String },
        country: { type: String },
        zipCode: { type: String },
      },
    },
    notifications: {
      emailEnabled: { type: Boolean, default: true },
      smsEnabled: { type: Boolean, default: false },
      bookingConfirmation: { type: Boolean, default: true },
      paymentReminders: { type: Boolean, default: true },
      checkInReminders: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Validation to ensure max booking length is greater than min
SettingsSchema.pre('validate', function (this: ISettings) {
  if (this.maxBookingLength <= this.minBookingLength) {
    throw new Error(
      'Maximum booking length must be greater than minimum booking length'
    );
  }
});

// Virtual: formatted full address from contactInfo.address
SettingsSchema.virtual('fullAddress').get(function (this: ISettings): string {
  const addr = this.contactInfo?.address;
  if (!addr) return '';
  return [addr.street, addr.city, addr.state, addr.zipCode, addr.country]
    .filter(Boolean)
    .join(', ');
});

// Static method: get the single settings document or create with defaults
SettingsSchema.statics.getSettings = async function (): Promise<ISettings> {
  const settings = await this.findOne();
  if (settings) return settings;
  return this.create({});
};

// Prevent model re-compilation in development
const Settings =
  mongoose.models.Settings ||
  mongoose.model<ISettings, ISettingsModel>('Settings', SettingsSchema);

export default Settings as ISettingsModel;
