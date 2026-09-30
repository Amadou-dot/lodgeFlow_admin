import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Booking, { type IBooking } from '../src/models/Booking';
import Cabin from '../src/models/Cabin';

let server: MongoMemoryServer;
const cabinId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
const otherCabinId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439012');
before(async () => {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri());
  await Promise.all([Booking.init(), Cabin.init()]);
});
after(async () => {
  await mongoose.disconnect();
  await server.stop();
});
beforeEach(async () => {
  await Promise.all([Booking.deleteMany({}), Cabin.deleteMany({})]);
  await Cabin.create(
    [cabinId, otherCabinId].map(_id => ({
      _id,
      name: `Cabin ${_id}`,
      description: 'Overlap fixture',
      image: 'https://example.invalid/cabin.jpg',
      price: 100,
      discount: 0,
      capacity: 4,
    }))
  );
});

function booking(overrides: Partial<Pick<IBooking, 'cabin' | 'status'>> = {}) {
  return Booking.create({
    cabin: cabinId,
    customer: 'overlap-customer',
    checkInDate: new Date('2030-06-01T00:00:00.000Z'),
    checkOutDate: new Date('2030-06-05T00:00:00.000Z'),
    numNights: 4,
    numGuests: 1,
    cabinPrice: 100,
    totalPrice: 400,
    status: 'confirmed',
    ...overrides,
  });
}

test('overlap reads preserve strict stay boundaries, hydration and unchanged state', async () => {
  const saved = await booking();
  const beforeRows = JSON.stringify(await Booking.find().lean());
  const windows = [
    { start: '2030-05-27', end: '2030-06-01', overlaps: false },
    { start: '2030-06-05', end: '2030-06-08', overlaps: false },
    { start: '2030-05-30', end: '2030-06-02', overlaps: true },
    { start: '2030-06-04', end: '2030-06-07', overlaps: true },
    { start: '2030-06-02', end: '2030-06-04', overlaps: true },
    { start: '2030-05-31', end: '2030-06-06', overlaps: true },
    { start: '2030-06-01', end: '2030-06-05', overlaps: true },
  ];
  for (const window of windows) {
    const start = new Date(window.start);
    const end = new Date(window.end);
    const originalDates = [start.getTime(), end.getTime()];
    const rows = await Booking.findOverlapping({
      cabinId: cabinId.toHexString(),
      checkInDate: start,
      checkOutDate: end,
    });
    assert.deepEqual(
      rows.map(row => String(row._id)),
      window.overlaps ? [String(saved._id)] : [],
      `${window.start} to ${window.end}`
    );
    assert.ok(rows.every(row => row instanceof mongoose.Document));
    assert.deepEqual([start.getTime(), end.getTime()], originalDates);
  }
  assert.equal(JSON.stringify(await Booking.find().lean()), beforeRows);
});

test('overlap reads exclude only cancelled status and other cabins', async () => {
  const included = await Promise.all([
    booking({ status: 'unconfirmed' }),
    booking({ status: 'confirmed' }),
    booking({ status: 'checked-in' }),
    booking({ status: 'checked-out' }),
  ]);
  await booking({ status: 'cancelled' });
  await booking({ cabin: otherCabinId });
  const rows = await Booking.findOverlapping({
    cabinId: cabinId.toHexString(),
    checkInDate: new Date('2030-06-02'),
    checkOutDate: new Date('2030-06-04'),
  });
  assert.deepEqual(
    rows.map(row => String(row._id)).sort(),
    included.map(row => String(row._id)).sort()
  );
});

test('self-exclusion retains other conflicts and ignores an unrelated excluded ID', async () => {
  const first = await booking();
  const second = await booking();
  const start = new Date('2030-06-01');
  const end = new Date('2030-06-05');
  const rows = await Booking.findOverlapping({
    cabinId: cabinId.toHexString(),
    checkInDate: start,
    checkOutDate: end,
    excludeBookingId: String(first._id),
  });
  assert.deepEqual(
    rows.map(row => String(row._id)),
    [String(second._id)]
  );
  const unrelated = await Booking.findOverlapping({
    cabinId: cabinId.toHexString(),
    checkInDate: start,
    checkOutDate: end,
    excludeBookingId: new mongoose.Types.ObjectId().toHexString(),
  });
  assert.deepEqual(
    unrelated.map(row => String(row._id)).sort(),
    [String(first._id), String(second._id)].sort()
  );
});
