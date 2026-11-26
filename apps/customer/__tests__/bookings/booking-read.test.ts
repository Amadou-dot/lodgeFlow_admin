/** @jest-environment node */
import {
  decodeBookingHistory,
  decodeBookingDetail,
} from '@/lib/validations/booking-read-json';
import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
const mockLeanBookings = jest.fn<Promise<unknown[]>, []>();
const mockDetailBooking = jest.fn<Promise<unknown>, []>();
jest.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: 'user_customer' }),
}));
jest.mock('@lodgeflow/database', () => ({
  ...jest.requireActual<typeof import('@lodgeflow/database')>(
    '@lodgeflow/database'
  ),
  connectDB: jest.fn(),
  Booking: {
    find: () => ({
      populate: () => ({ sort: () => ({ lean: mockLeanBookings }) }),
    }),
    findById: () => ({ populate: mockDetailBooking }),
  },
}));
import { GET as historyRoute } from '@/app/api/bookings/history/route';
import { GET as detailRoute } from '@/app/api/bookings/[id]/route';
import Booking from '@lodgeflow/database/models/Booking';
import Cabin, { type ICabin } from '@lodgeflow/database/models/Cabin';
import {
  serializeBookingDetail,
  serializeBookingHistory,
  type BookingReadSource,
} from '@/lib/serializers/booking-read';

const id = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
const cabinId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439012');
const sparseBooking = {
  _id: id,
  customer: 'user_customer',
  cabin: null,
  checkInDate: new Date('2020-01-01T00:00:00.000Z'),
  checkOutDate: new Date('2020-01-03T00:00:00.000Z'),
  numNights: 2,
  numGuests: 2,
  status: 'confirmed',
  cabinPrice: 200,
  totalPrice: 200,
  observations: null,
  paidAt: null,
} satisfies BookingReadSource & { cabin: null };

// Round-trip comparisons use the same JSON boundary as NextResponse.json.
function json(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

describe('booking read serializers', () => {
  it('preserves sparse lean history, nulls and omitted defaults without adding virtuals', () => {
    const result = json(serializeBookingHistory(sparseBooking));
    expect(result).toEqual(json(sparseBooking));
    expect(result).not.toHaveProperty('id');
    expect(result).not.toHaveProperty('payments');
    expect(result).not.toHaveProperty('extras');
  });

  it('preserves explicit null receipts and extras on legacy rows', () => {
    const booking = {
      ...sparseBooking,
      payments: null,
      cancellationRefunds: null,
      extras: null,
    };
    expect(json(serializeBookingHistory(booking))).toEqual(json(booking));
  });

  it('matches hydrated booking and cabin JSON, including virtuals and receipt dates', () => {
    const TypedCabin = mongoose.model<ICabin>('Cabin', Cabin.schema);
    const cabin = new TypedCabin({
      _id: cabinId,
      name: 'Pine',
      image: 'https://example.com/pine.jpg',
      capacity: 4,
      price: 100,
      discount: 10,
      description: 'Forest cabin',
      createdAt: new Date('2020-01-01T00:00:00.000Z'),
      updatedAt: new Date('2020-01-02T00:00:00.000Z'),
      __v: 3,
    });
    const booking = new Booking({
      ...sparseBooking,
      cabin: cabinId,
      __v: 2,
      payments: [
        {
          id: 'receipt',
          amount: 50,
          method: 'online',
          receivedAt: new Date('2020-01-01T12:00:00.000Z'),
        },
      ],
      amountPaid: 50,
      remainingAmount: 150,
    });
    // Mongoose's populate return type models the path override; assignment here
    // exercises actual document getters and JSON virtuals without a database.
    booking.$set('cabin', cabin);
    const populated = Object.assign(booking, {
      cabin: Object.assign(cabin, { _id: cabinId }),
    });
    expect(json(serializeBookingDetail(populated))).toEqual(json(booking));
  });
});

it('reads sparse stored history and hydrated detail from the two GET handlers', async () => {
  const common = {
    ...sparseBooking,
    specialRequests: [null, 'Towels'],
    extras: { hasPets: null },
    amountPaid: null,
  };
  const hydrated = Booking.hydrate({ ...common, status: null });
  mockDetailBooking.mockResolvedValue(hydrated);
  const requestedId = id.toHexString().toUpperCase();
  const detailResponse = await detailRoute(
    new NextRequest('https://customer.test'),
    { params: Promise.resolve({ id: requestedId }) }
  );
  const detail = await detailResponse.json();
  expect(detailResponse.status).toBe(200);
  expect(detail.data).toMatchObject({
    id: id.toHexString(),
    status: null,
    specialRequests: [null, 'Towels'],
    amountPaid: null,
    extras: { hasPets: null },
  });
  expect(decodeBookingDetail(requestedId)(detail)).toBe(detail.data);

  mockLeanBookings.mockResolvedValue([
    {
      ...common,
      status: undefined,
      cabin: {
        _id: cabinId,
        name: 'Pine',
        image: '/pine',
        description: 'Cabin',
        capacity: 2,
        price: 1.235,
      },
    },
  ]);
  const historyResponse = await historyRoute(
    new NextRequest('https://customer.test')
  );
  const history = await historyResponse.json();
  expect(historyResponse.status).toBe(200);
  expect(history.data[0]).toMatchObject({
    specialRequests: [null, 'Towels'],
    extras: { hasPets: null },
    amountPaid: null,
    cabin: { _id: cabinId.toHexString(), price: 1.235 },
  });
  expect(history.data[0]).not.toHaveProperty('status');
  expect(history.data[0].cabin).not.toHaveProperty('images');
  expect(decodeBookingHistory({ userId: common.customer })(history)).toBe(
    history.data
  );
  expect(
    decodeBookingDetail(requestedId)({ success: true, data: history.data[0] })
  ).toBeUndefined();
  const extras = { ...history.data[0].extras, future: 'retained' };
  const rows = [{ ...history.data[0], extras }];
  expect(
    decodeBookingHistory({ userId: common.customer })({
      success: true,
      data: rows,
    })
  ).toBe(rows);
});
