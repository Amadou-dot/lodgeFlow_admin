/** @jest-environment node */
import { Types } from 'mongoose';
import { Settings } from '@lodgeflow/database';
import { GET } from '@/app/api/settings/route';
import { settingsResponseSchema } from '@/lib/validations/settings-json';

jest.mock('@lodgeflow/database', () => ({
  ...jest.requireActual<typeof import('@lodgeflow/database')>(
    '@lodgeflow/database'
  ),
  connectDB: jest.fn().mockResolvedValue(undefined),
}));

afterEach(() => jest.restoreAllMocks());

test('customer GET returns the customer-created defaults without contact information', async () => {
  jest.spyOn(Settings, 'findOne').mockResolvedValueOnce(null);
  jest.spyOn(Settings, 'init').mockImplementation(async () => new Settings());
  jest.spyOn(Settings.collection, 'insertOne').mockResolvedValue({
    acknowledged: true,
    insertedId: new Types.ObjectId(),
  });

  const response = await GET();
  const body: unknown = await response.json();
  expect(response.status).toBe(200);
  expect(settingsResponseSchema.parse(body)).toEqual(body);
  expect(body).toMatchObject({
    success: true,
    data: {
      singleton: 'global',
      fullAddress: '',
      minBookingLength: 2,
      maxBookingLength: 30,
      maxGuestsPerBooking: 8,
      breakfastPrice: 15,
      checkInTime: '15:00',
      checkOutTime: '11:00',
      cancellationPolicy: 'moderate',
      requireDeposit: true,
      depositPercentage: 25,
      allowPets: true,
      petFee: 20,
      smokingAllowed: false,
      earlyCheckInFee: 50,
      lateCheckOutFee: 50,
      wifiIncluded: true,
      parkingIncluded: false,
      parkingFee: 10,
      currency: 'USD',
      timezone: 'UTC',
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
      __v: 0,
    },
  });
  expect(body).not.toHaveProperty('data.contactInfo');
  expect(body).toHaveProperty('data.createdAt');
  expect(body).toHaveProperty('data.updatedAt');
});

test('customer GET preserves fractional settings and null contactInfo on a sparse legacy document', async () => {
  const id = new Types.ObjectId();
  const settings = Settings.hydrate({
    _id: id,
    contactInfo: null,
    breakfastPrice: 12.075,
    businessHours: { daysOpen: ['Monday'] },
    notifications: { emailEnabled: false },
  });
  jest.spyOn(Settings, 'findOne').mockResolvedValueOnce(settings);

  const response = await GET();
  const body: unknown = await response.json();
  expect(response.status).toBe(200);
  expect(settingsResponseSchema.parse(body)).toEqual(body);
  expect(body).toEqual({
    success: true,
    data: JSON.parse(JSON.stringify(settings)),
  });
  expect(body).toMatchObject({
    success: true,
    data: {
      _id: id.toHexString(),
      id: id.toHexString(),
      fullAddress: '',
      breakfastPrice: 12.075,
      contactInfo: null,
      businessHours: { open: '09:00', close: '18:00', daysOpen: ['Monday'] },
      notifications: { emailEnabled: false },
    },
  });
  expect(body).not.toHaveProperty('data.singleton');
  expect(body).not.toHaveProperty('data.createdAt');
});
