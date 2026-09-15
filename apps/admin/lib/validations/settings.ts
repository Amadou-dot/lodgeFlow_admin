import { z } from 'zod';

const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

const dayOfWeekSchema = z.enum([
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
]);

const addressSchema = z
  .object({
    street: z.string().max(200).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    country: z.string().max(100).optional(),
    zipCode: z.string().max(20).optional(),
  })
  .strict();

const contactInfoSchema = z
  .object({
    phone: z
      .string()
      .regex(/^[+]?[1-9][\d]{0,15}$/, 'Please provide a valid phone number')
      .optional(),
    email: z.string().email('Please provide a valid email address').optional(),
    address: addressSchema.optional(),
  })
  .strict();

const businessHoursSchema = z
  .object({
    open: z
      .string()
      .regex(timeRegex, 'Business open time must be in HH:MM format')
      .optional(),
    close: z
      .string()
      .regex(timeRegex, 'Business close time must be in HH:MM format')
      .optional(),
    daysOpen: z.array(dayOfWeekSchema).optional(),
  })
  .strict();

const notificationsSchema = z
  .object({
    emailEnabled: z.boolean().optional(),
    smsEnabled: z.boolean().optional(),
    bookingConfirmation: z.boolean().optional(),
    paymentReminders: z.boolean().optional(),
    checkInReminders: z.boolean().optional(),
  })
  .strict();

const cancellationPolicySchema = z.enum(['flexible', 'moderate', 'strict']);

const settingsFieldsSchema = z.object({
  minBookingLength: z
    .number()
    .int()
    .min(1, 'Minimum booking length must be at least 1 day')
    .max(30, 'Minimum booking length cannot exceed 30 days')
    .optional(),
  maxBookingLength: z
    .number()
    .int()
    .min(1, 'Maximum booking length must be at least 1 day')
    .max(365, 'Maximum booking length cannot exceed 365 days')
    .optional(),
  maxGuestsPerBooking: z
    .number()
    .int()
    .min(1, 'Maximum guests must be at least 1')
    .max(50, 'Maximum guests cannot exceed 50')
    .optional(),
  breakfastPrice: z
    .number()
    .min(0, 'Breakfast price must be positive')
    .optional(),
  checkInTime: z
    .string()
    .regex(timeRegex, 'Check-in time must be in HH:MM format')
    .optional(),
  checkOutTime: z
    .string()
    .regex(timeRegex, 'Check-out time must be in HH:MM format')
    .optional(),
  cancellationPolicy: cancellationPolicySchema.optional(),
  requireDeposit: z.boolean().optional(),
  depositPercentage: z
    .number()
    .min(0, 'Deposit percentage must be positive')
    .max(100, 'Deposit percentage cannot exceed 100')
    .optional(),
  allowPets: z.boolean().optional(),
  petFee: z.number().min(0, 'Pet fee must be positive').optional(),
  smokingAllowed: z.boolean().optional(),
  earlyCheckInFee: z
    .number()
    .min(0, 'Early check-in fee must be positive')
    .optional(),
  lateCheckOutFee: z
    .number()
    .min(0, 'Late check-out fee must be positive')
    .optional(),
  wifiIncluded: z.boolean().optional(),
  parkingIncluded: z.boolean().optional(),
  parkingFee: z.number().min(0, 'Parking fee must be positive').optional(),
  currency: z
    .string()
    .length(3, 'Currency code must be 3 characters')
    .regex(/^[A-Z]{3}$/, 'Currency code must be 3 uppercase characters')
    .optional(),
  timezone: z.string().max(100).optional(),
  businessHours: businessHoursSchema.optional(),
  contactInfo: contactInfoSchema.optional(),
  notifications: notificationsSchema.optional(),
});

export const updateSettingsSchema = settingsFieldsSchema
  .strict()
  .superRefine((data, ctx) => {
    if (
      data.minBookingLength !== undefined &&
      data.maxBookingLength !== undefined &&
      data.minBookingLength > data.maxBookingLength
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Maximum booking length must be greater than or equal to minimum booking length',
        path: ['maxBookingLength'],
      });
    }
  });

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

const MONGO_METADATA_KEYS = [
  '_id',
  'id',
  'createdAt',
  'updatedAt',
  '__v',
] as const;

export function stripSettingsMongoMetadata(
  body: Record<string, unknown>
): Record<string, unknown> {
  const cleaned = { ...body };
  for (const key of MONGO_METADATA_KEYS) {
    delete cleaned[key];
  }
  return cleaned;
}

export function getBookingLengthRangeError(
  minBookingLength: number,
  maxBookingLength: number
): string | null {
  if (minBookingLength > maxBookingLength) {
    return 'Maximum booking length must be greater than or equal to minimum booking length';
  }
  return null;
}
