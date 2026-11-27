import { z } from 'zod';

const id = z.string().regex(/^[a-f0-9]{24}$/i);
// Match the serializer's Date.toISOString() output, including signed years.
const timestamp = z.string().refine(value => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
});
const nullableText = z.string().nullish();

const contactInfo = z
  .looseObject({
    phone: nullableText,
    email: nullableText,
    address: z
      .looseObject({
        street: nullableText,
        city: nullableText,
        state: nullableText,
        country: nullableText,
        zipCode: nullableText,
      })
      .nullish(),
  })
  .nullish();

const businessHours = z
  .looseObject({
    open: z.string(),
    close: z.string(),
    daysOpen: z.array(z.string().nullable()).nullable(),
  })
  .partial()
  .nullish();

const notifications = z
  .looseObject({
    emailEnabled: z.boolean().nullable(),
    smsEnabled: z.boolean().nullable(),
    bookingConfirmation: z.boolean().nullable(),
    paymentReminders: z.boolean().nullable(),
    checkInReminders: z.boolean().nullable(),
  })
  .partial()
  .nullish();

// Both apps serialize the same hydrated Settings data. Keep legacy omissions,
// explicit nulls and additive fields without applying edit validation or defaults.
export const settingsJsonSchema = z.looseObject({
  _id: id,
  id,
  singleton: nullableText,
  fullAddress: z.string(),
  minBookingLength: z.number(),
  maxBookingLength: z.number(),
  maxGuestsPerBooking: z.number(),
  breakfastPrice: z.number(),
  checkInTime: z.string(),
  checkOutTime: z.string(),
  cancellationPolicy: z.enum(['flexible', 'moderate', 'strict']).nullable(),
  requireDeposit: z.boolean().nullable(),
  depositPercentage: z.number(),
  allowPets: z.boolean().nullable(),
  petFee: z.number().nullable(),
  smokingAllowed: z.boolean().nullable(),
  earlyCheckInFee: z.number().nullable(),
  lateCheckOutFee: z.number().nullable(),
  wifiIncluded: z.boolean().nullable(),
  parkingIncluded: z.boolean().nullable(),
  parkingFee: z.number().nullable(),
  currency: z.string().nullable(),
  timezone: z.string().nullable(),
  businessHours,
  contactInfo,
  notifications,
  createdAt: timestamp.nullish(),
  updatedAt: timestamp.nullish(),
  __v: z.number().nullish(),
});

export type SettingsJson = z.output<typeof settingsJsonSchema>;
