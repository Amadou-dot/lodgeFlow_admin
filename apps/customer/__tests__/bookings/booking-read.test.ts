/** @jest-environment node */
import mongoose from 'mongoose';
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
