import type { UpdateSettingsInput } from '@/lib/validations/settings';
import type { AppSettings } from '@/types';

type EditableSettings = Pick<
  UpdateSettingsInput,
  | 'minBookingLength'
  | 'maxBookingLength'
  | 'maxGuestsPerBooking'
  | 'cancellationPolicy'
  | 'checkInTime'
  | 'checkOutTime'
  | 'earlyCheckInFee'
  | 'lateCheckOutFee'
  | 'breakfastPrice'
  | 'petFee'
  | 'requireDeposit'
  | 'depositPercentage'
  | 'wifiIncluded'
  | 'parkingIncluded'
  | 'parkingFee'
  | 'allowPets'
  | 'smokingAllowed'
>;

export type SettingsEdit = {
  [Field in keyof EditableSettings]-?: {
    field: Field;
    value: Exclude<EditableSettings[Field], undefined>;
  };
}[keyof EditableSettings];

export type SettingsSectionProps = {
  formData: Partial<AppSettings>;
  onInputChange: (edit: SettingsEdit) => void;
};
