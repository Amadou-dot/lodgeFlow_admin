import type { IBooking } from '@lodgeflow/database/models/Booking';
import type { Types } from 'mongoose';

jest.mock('@lodgeflow/database/mongodb', () =>
  jest.fn().mockResolvedValue(undefined)
);

import { GET } from '@/app/api/bookings/stats/route';
import {
  bookingStatsJsonSchema,
  parseReportJson,
} from '@/lib/validations/reporting-json';
import Booking from '@lodgeflow/database/models/Booking';
import Cabin from '@lodgeflow/database/models/Cabin';

async function createTestCabin() {
  return Cabin.create({
    name: 'Stats Test Cabin',
    description: 'A cabin for stats tests',
    capacity: 4,
    price: 200,
    discount: 0,
    image: 'https://example.com/cabin.jpg',
    amenities: ['WiFi'],
    status: 'active',
  });
}

async function createTestBooking(
  cabinId: Types.ObjectId,
  overrides: Partial<
    Pick<IBooking, 'status' | 'checkInDate' | 'checkOutDate'>
  > = {}
) {
  return Booking.create({
    cabin: cabinId,
    customer: 'user_test123',
    checkInDate: new Date('2027-06-01'),
    checkOutDate: new Date('2027-06-04'),
    numNights: 3,
    numGuests: 2,
    cabinPrice: 600,
    totalPrice: 600,
    ...overrides,
  });
}

async function readBookingStats() {
  const response = await GET();
  expect(response.status).toBe(200);
  const value: unknown = await response.json();

  return parseReportJson({
    value,
    schema: bookingStatsJsonSchema,
    format: 'wrapped',
    errorMessage: 'Unexpected booking stats response',
  });
}

describe('Booking Stats API', () => {
  describe('GET /api/bookings/stats', () => {
    it('returns all zero stats when no bookings', async () => {
      expect(await readBookingStats()).toEqual({
        todayCheckIns: 0,
        todayCheckOuts: 0,
        checkedIn: 0,
        unconfirmed: 0,
      });
    });

    it('counts unconfirmed bookings', async () => {
      const cabin = await createTestCabin();
      await createTestBooking(cabin._id, { status: 'unconfirmed' });
      await createTestBooking(cabin._id, {
        status: 'unconfirmed',
        checkInDate: new Date('2027-07-01'),
        checkOutDate: new Date('2027-07-04'),
      });
      await createTestBooking(cabin._id, {
        status: 'confirmed',
        checkInDate: new Date('2027-08-01'),
        checkOutDate: new Date('2027-08-04'),
      });

      const data = await readBookingStats();

      expect(data.unconfirmed).toBe(2);
    });

    it('counts checked-in bookings', async () => {
      const cabin = await createTestCabin();
      await createTestBooking(cabin._id, { status: 'checked-in' });

      const data = await readBookingStats();

      expect(data.checkedIn).toBe(1);
    });

    it('counts today check-ins', async () => {
      const cabin = await createTestCabin();
      const today = new Date();
      today.setHours(12, 0, 0, 0);

      await createTestBooking(cabin._id, {
        checkInDate: today,
        checkOutDate: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000),
        status: 'confirmed',
      });

      const data = await readBookingStats();

      expect(data.todayCheckIns).toBe(1);
    });

    it('excludes cancelled bookings from today check-ins', async () => {
      const cabin = await createTestCabin();
      const today = new Date();
      today.setHours(12, 0, 0, 0);

      await createTestBooking(cabin._id, {
        checkInDate: today,
        checkOutDate: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000),
        status: 'cancelled',
      });

      const data = await readBookingStats();

      expect(data.todayCheckIns).toBe(0);
    });

    it('counts today check-outs', async () => {
      const cabin = await createTestCabin();
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);

      await createTestBooking(cabin._id, {
        checkInDate: threeDaysAgo,
        checkOutDate: today,
        status: 'checked-in',
      });

      const data = await readBookingStats();

      expect(data.todayCheckOuts).toBe(1);
    });
  });
});
