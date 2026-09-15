import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Booking, Cabin, Settings } from '../src';

let server: MongoMemoryServer;
before(async () => {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri());
  await Promise.all([Booking.init(), Cabin.init(), Settings.init()]);
});
after(async () => {
  await mongoose.disconnect();
  await server?.stop();
});
beforeEach(async () => {
  await Promise.all([
    Booking.deleteMany({}),
    Cabin.deleteMany({}),
    Settings.deleteMany({}),
  ]);
});

const cabinInput = {
  name: 'Shared cabin',
  image: 'https://example.com/cabin.jpg',
  capacity: 4,
  price: 200,
  discount: 20,
  description: 'Cabin used by both applications',
};
const bookingInput = () => ({
  cabin: new mongoose.Types.ObjectId(),
  customer: 'test-customer',
  checkInDate: new Date('2030-06-01T00:00:00Z'),
  checkOutDate: new Date('2030-06-04T00:00:00Z'),
  numNights: 9,
  numGuests: 2,
  cabinPrice: 180,
  extrasPrice: 0,
  totalPrice: 540,
  depositAmount: 135,
});

test('shared booking computes nights and rejects negative extras', async () => {
  const booking = await Booking.create(bookingInput());
  assert.equal(booking.numNights, 3);
  assert.equal(booking.remainingAmount, 405);
  await assert.rejects(
    Booking.create({ ...bookingInput(), extras: { petFee: -1 } })
  );
});

test('overlap index has one explicitly named non-partial definition', () => {
  const indexes = Booking.schema.indexes().filter(([keys]) => 'cabin' in keys);
  assert.equal(indexes.length, 1);
  assert.equal(indexes[0][1].name, 'cabin_1_checkInDate_1_checkOutDate_1');
  assert.equal(indexes[0][1].partialFilterExpression, undefined);
});

test('shared cabin validates update price and caps amenities', async () => {
  const cabin = await Cabin.create(cabinInput);
  await assert.rejects(
    Cabin.findByIdAndUpdate(
      cabin._id,
      { $set: { price: 10, discount: 20 } },
      { runValidators: true }
    )
  );
  await assert.rejects(
    Cabin.create({ ...cabinInput, amenities: Array(21).fill('WiFi') })
  );
  await assert.rejects(
    Cabin.create({ ...cabinInput, images: ['invalid-url'] })
  );
});

test('settings accept equal minimum/maximum and enforce caps', async () => {
  const settings = new Settings({ minBookingLength: 1, maxBookingLength: 1 });
  await settings.validate();
  assert.equal(settings.maxGuestsPerBooking, 8);
  await assert.rejects(new Settings({ maxBookingLength: 366 }).validate());
  await assert.rejects(
    new Settings({ minBookingLength: 3, maxBookingLength: 2 }).validate()
  );
});

test('concurrent first reads create one settings document', async () => {
  const results = await Promise.all(
    Array.from({ length: 8 }, () => Settings.getSettings())
  );
  assert.equal(await Settings.countDocuments(), 1);
  assert.equal(new Set(results.map(s => String(s._id))).size, 1);
  assert.equal(results[0].depositPercentage, 25);
});
