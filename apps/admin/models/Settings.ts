import { settingsData } from '@/lib/data/seed-data';
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
  businessHours: {
    open: string;
    close: string;
    daysOpen: string[];
  };
  contactInfo: {
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
  notifications: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    bookingConfirmation: boolean;
    paymentReminders: boolean;
    checkInReminders: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface ISettingsModel extends Model<ISettings> {
  getSettings(): Promise<ISettings>;
}

const SettingsSchema: Schema<ISettings, ISettingsModel> = new Schema(
  {
    minBookingLength: {
      type: Number,
      required: [true, 'Minimum booking length is required'],
      min: [1, 'Minimum booking length must be at least 1 day'],
      max: [30, 'Minimum booking length cannot exceed 30 days'],
    },
    maxBookingLength: {
      type: Number,
      required: [true, 'Maximum booking length is required'],
      min: [1, 'Maximum booking length must be at least 1 day'],
      max: [365, 'Maximum booking length cannot exceed 365 days'],
      validate: {
        validator: function (this: ISettings, maxLength: number) {
          return maxLength >= this.minBookingLength;
        },
        message:
          'Maximum booking length must be greater than or equal to minimum booking length',
      },
    },
    maxGuestsPerBooking: {
      type: Number,
      required: [true, 'Maximum guests per booking is required'],
      min: [1, 'Maximum guests must be at least 1'],
      max: [50, 'Maximum guests cannot exceed 50'],
    },
    breakfastPrice: {
      type: Number,
      required: [true, 'Breakfast price is required'],
      min: [0, 'Breakfast price must be positive'],
    },
    checkInTime: {
      type: String,
      required: [true, 'Check-in time is required'],
      validate: {
        validator: function (v: string) {
          return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: 'Check-in time must be in HH:MM format',
      },
    },
    checkOutTime: {
      type: String,
      required: [true, 'Check-out time is required'],
      validate: {
        validator: function (v: string) {
          return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: 'Check-out time must be in HH:MM format',
      },
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
      required: [true, 'Deposit percentage is required'],
      min: [0, 'Deposit percentage must be positive'],
      max: [100, 'Deposit percentage cannot exceed 100'],
    },
    allowPets: {
      type: Boolean,
      default: true,
    },
    petFee: {
      type: Number,
      default: 0,
      min: [0, 'Pet fee must be positive'],
    },
    smokingAllowed: {
      type: Boolean,
      default: false,
    },
    earlyCheckInFee: {
      type: Number,
      default: 0,
      min: [0, 'Early check-in fee must be positive'],
    },
    lateCheckOutFee: {
      type: Number,
      default: 0,
      min: [0, 'Late check-out fee must be positive'],
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
      default: 0,
      min: [0, 'Parking fee must be positive'],
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
      minlength: [3, 'Currency code must be 3 characters'],
      maxlength: [3, 'Currency code must be 3 characters'],
    },
    timezone: {
      type: String,
      default: 'UTC',
    },
    businessHours: {
      open: {
        type: String,
        default: '09:00',
        validate: {
          validator: function (v: string) {
            return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
          },
          message: 'Business open time must be in HH:MM format',
        },
      },
      close: {
        type: String,
        default: '18:00',
        validate: {
          validator: function (v: string) {
            return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
          },
          message: 'Business close time must be in HH:MM format',
        },
      },
      daysOpen: [
        {
          type: String,
          enum: [
            'monday',
            'tuesday',
            'wednesday',
            'thursday',
            'friday',
            'saturday',
            'sunday',
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
          ],
        },
      ],
    },
    contactInfo: {
      phone: {
        type: String,
        trim: true,
        validate: {
          validator: function (v: string) {
            return !v || /^[+]?[1-9][\d]{0,15}$/.test(v);
          },
          message: 'Please provide a valid phone number',
        },
      },
      email: {
        type: String,
        lowercase: true,
        trim: true,
        validate: {
          validator: function (v: string) {
            return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
          },
          message: 'Please provide a valid email address',
        },
      },
      address: {
        street: { type: String, trim: true },
        city: { type: String, trim: true },
        state: { type: String, trim: true },
        country: { type: String, trim: true },
        zipCode: { type: String, trim: true },
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
  }
);

// Ensure only one settings document exists
SettingsSchema.index({}, { unique: true });

// Static method to get or create settings
SettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({
      ...settingsData,
      businessHours: {
        open: '09:00',
        close: '18:00',
        daysOpen: [
          'monday',
          'tuesday',
          'wednesday',
          'thursday',
          'friday',
          'saturday',
          'sunday',
        ],
      },
      notifications: {
        emailEnabled: true,
        smsEnabled: false,
        bookingConfirmation: true,
        paymentReminders: true,
        checkInReminders: true,
      },
    });
  }
  return settings;
};

// Virtual for full contact address
SettingsSchema.virtual('fullAddress').get(function (this: ISettings) {
  if (!this.contactInfo?.address) return '';
  const { street, city, state, country, zipCode } = this.contactInfo.address;
  return [street, city, state, country, zipCode].filter(Boolean).join(', ');
});

// Ensure virtual fields are serialized
SettingsSchema.set('toJSON', { virtuals: true });
SettingsSchema.set('toObject', { virtuals: true });

const Settings =
  (mongoose.models.Settings as ISettingsModel) ||
  mongoose.model<ISettings, ISettingsModel>('Settings', SettingsSchema);

export default Settings;
