import { Types } from 'mongoose';
import type { ISettings } from './models/Settings';

type SettingsFields = Pick<
  ISettings,
  | 'singleton'
  | 'minBookingLength'
  | 'maxBookingLength'
  | 'maxGuestsPerBooking'
  | 'breakfastPrice'
  | 'checkInTime'
  | 'checkOutTime'
  | 'cancellationPolicy'
  | 'requireDeposit'
  | 'depositPercentage'
  | 'allowPets'
  | 'petFee'
  | 'smokingAllowed'
  | 'earlyCheckInFee'
  | 'lateCheckOutFee'
  | 'wifiIncluded'
  | 'parkingIncluded'
  | 'parkingFee'
  | 'currency'
  | 'timezone'
  | 'businessHours'
  | 'notifications'
  | 'fullAddress'
>;

export interface SettingsJson extends SettingsFields {
  _id: string;
  id: string;
  contactInfo?: ISettings['contactInfo'];
  createdAt?: string;
  updatedAt?: string;
  __v?: number;
}

export interface SettingsJsonSource extends SettingsFields {
  _id: Types.ObjectId;
  contactInfo?: ISettings['contactInfo'];
  createdAt?: Date;
  updatedAt?: Date;
  __v?: number;
}

/** Accept the plain document projection so MongoDB's nested minimization is preserved. */
export function serializeSettings(settings: SettingsJsonSource): SettingsJson {
  if (!(settings._id instanceof Types.ObjectId)) {
    throw new TypeError('Expected a MongoDB ObjectId');
  }
  return {
    _id: settings._id.toHexString(),
    id: settings._id.toHexString(),
    singleton: settings.singleton,
    minBookingLength: settings.minBookingLength,
    maxBookingLength: settings.maxBookingLength,
    maxGuestsPerBooking: settings.maxGuestsPerBooking,
    breakfastPrice: settings.breakfastPrice,
    checkInTime: settings.checkInTime,
    checkOutTime: settings.checkOutTime,
    cancellationPolicy: settings.cancellationPolicy,
    requireDeposit: settings.requireDeposit,
    depositPercentage: settings.depositPercentage,
    allowPets: settings.allowPets,
    petFee: settings.petFee,
    smokingAllowed: settings.smokingAllowed,
    earlyCheckInFee: settings.earlyCheckInFee,
    lateCheckOutFee: settings.lateCheckOutFee,
    wifiIncluded: settings.wifiIncluded,
    parkingIncluded: settings.parkingIncluded,
    parkingFee: settings.parkingFee,
    currency: settings.currency,
    timezone: settings.timezone,
    businessHours:
      settings.businessHours == null
        ? settings.businessHours
        : {
            open: settings.businessHours.open,
            close: settings.businessHours.close,
            daysOpen:
              settings.businessHours.daysOpen == null
                ? settings.businessHours.daysOpen
                : [...settings.businessHours.daysOpen],
          },
    contactInfo:
      settings.contactInfo == null
        ? settings.contactInfo
        : {
            phone: settings.contactInfo.phone,
            email: settings.contactInfo.email,
            address:
              settings.contactInfo.address == null
                ? settings.contactInfo.address
                : {
                    street: settings.contactInfo.address.street,
                    city: settings.contactInfo.address.city,
                    state: settings.contactInfo.address.state,
                    country: settings.contactInfo.address.country,
                    zipCode: settings.contactInfo.address.zipCode,
                  },
          },
    notifications:
      settings.notifications == null
        ? settings.notifications
        : {
            emailEnabled: settings.notifications.emailEnabled,
            smsEnabled: settings.notifications.smsEnabled,
            bookingConfirmation: settings.notifications.bookingConfirmation,
            paymentReminders: settings.notifications.paymentReminders,
            checkInReminders: settings.notifications.checkInReminders,
          },
    fullAddress: settings.fullAddress,
    createdAt:
      settings.createdAt == null
        ? settings.createdAt
        : settings.createdAt.toISOString(),
    updatedAt:
      settings.updatedAt == null
        ? settings.updatedAt
        : settings.updatedAt.toISOString(),
    __v: settings.__v,
  };
}
