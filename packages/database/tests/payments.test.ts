import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  Booking,
  Cabin,
  Settings,
  addBookingPayment,
  settleCheckoutPayment,
  createCustomerBooking,
  updateCustomerBooking,
  BookingRuleError,
  buildDemoBookings,
  BookingPaymentError,
} from '../src';
let server: MongoMemoryServer;
before(async () => {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri());
  await Promise.all([Booking.init(), Cabin.init(), Settings.init()]);
});
after(async () => {
  await mongoose.disconnect();
  await server.stop();
});
beforeEach(async () => {
  await Promise.all([
    Booking.deleteMany({}),
    Cabin.deleteMany({}),
    Settings.deleteMany({}),
  ]);
});
async function selection() {
  const cabin = await Cabin.create({
    name: 'Payment cabin',
    price: 200,
    discount: 0,
    capacity: 4,
    minNights: 2,
    image: 'https://example.com/c.jpg',
    description: 'Test cabin',
    extraGuestFee: 20,
  });
  return {
    cabinId: String(cabin._id),
    customerId: 'customer',
    checkInDate: new Date('2030-06-01'),
    checkOutDate: new Date('2030-06-04'),
    numGuests: 1,
  };
}
test('deposit due never reduces balance; receipt retries are idempotent and overpayments rejected', async () => {
  const booking = await createCustomerBooking(await selection());
  assert.equal(booking.depositAmount, 150);
  assert.equal(booking.remainingAmount, 600);
  const payment = {
    id: 'cash-1',
    amount: 100,
    method: 'cash' as const,
    receivedAt: new Date(),
  };
  assert.equal(addBookingPayment(booking, payment), true);
  await booking.save();
  assert.equal(booking.depositPaid, false);
  assert.equal(booking.amountPaid, 100);
  assert.equal(booking.remainingAmount, 500);
  assert.equal(addBookingPayment(booking, payment), false);
  assert.throws(() =>
    addBookingPayment(booking, { ...payment, id: 'cash-2', amount: 501 })
  );
  assert.throws(() => addBookingPayment(booking, { ...payment, amount: 99 }));
});
test('simultaneous overlapping cabin requests have one winner', async () => {
  const input = await selection();
  const attempts = await Promise.allSettled(
    Array.from({ length: 6 }, () => createCustomerBooking(input))
  );
  assert.equal(attempts.filter(a => a.status === 'fulfilled').length, 1);
  assert.equal(await Booking.countDocuments(), 1);
});
test('customer updates enforce ownership, capacity, pricing, and block paid or pending repricing', async () => {
  const booking = await createCustomerBooking(await selection());
  const id = String(booking._id);
  await assert.rejects(
    updateCustomerBooking({
      bookingId: id,
      customerId: 'someone-else',
      updates: { numGuests: 2 },
    })
  );
  await assert.rejects(
    updateCustomerBooking({
      bookingId: id,
      customerId: 'customer',
      updates: { numGuests: 5 },
    })
  );
  const updated = await updateCustomerBooking({
    bookingId: id,
    customerId: 'customer',
    updates: {
      numGuests: 3,
      extras: { hasBreakfast: true },
    },
  });
  assert.equal(updated.totalPrice, 855);
  assert.equal(updated.depositAmount, 214);
  updated.checkoutPending = true;
  await updated.save();
  await assert.rejects(
    updateCustomerBooking({
      bookingId: id,
      customerId: 'customer',
      updates: { numGuests: 2 },
    })
  );
  updated.checkoutPending = false;
  addBookingPayment(updated, {
    id: 'cash',
    amount: 100,
    method: 'cash',
    receivedAt: new Date(),
  });
  await updated.save();
  await assert.rejects(
    updateCustomerBooking({
      bookingId: id,
      customerId: 'customer',
      updates: { numGuests: 2 },
    })
  );
  await updateCustomerBooking({
    bookingId: id,
    customerId: 'customer',
    updates: {
      specialRequests: ['Extra towels'],
    },
  });
});
test('concurrent duplicate Stripe deliveries record one receipt and reject mismatched quotes', async () => {
  const booking = await createCustomerBooking(await selection());
  Object.assign(booking, {
    checkoutPending: true,
    checkoutToken: 'quote',
    checkoutAmount: 150,
    checkoutTotalPrice: 600,
    checkoutCurrency: 'usd',
  });
  await booking.save();
  const receipt = {
    bookingId: String(booking._id),
    quoteToken: 'quote',
    sessionId: 'cs_test',
    paymentIntentId: 'pi_test',
    amount: 150,
    currency: 'usd',
  };
  await assert.rejects(settleCheckoutPayment({ ...receipt, amount: 151 }));
  const results = await Promise.all(
    Array.from({ length: 5 }, () => settleCheckoutPayment(receipt))
  );
  assert.equal(results.filter(r => r.changed).length, 1);
  const saved = await Booking.findById(booking._id);
  assert.equal(saved?.payments.length, 1);
  assert.equal(saved?.remainingAmount, 450);
  assert.equal(saved?.checkoutPending, false);
});

test('checkout rejects invalid receipt money even when its booking no longer exists', async () => {
  for (const amount of [NaN, Infinity, -1, 0, 1.005, Number.MAX_SAFE_INTEGER]) {
    await assert.rejects(
      settleCheckoutPayment({
        bookingId: new mongoose.Types.ObjectId().toString(),
        quoteToken: 'quote',
        sessionId: 'cs_invalid',
        paymentIntentId: 'pi_invalid',
        currency: 'usd',
        amount,
      }),
      BookingPaymentError
    );
  }
  assert.equal(await Booking.countDocuments(), 0);
});
test('optimistic saves prevent two concurrent offline payments from overwriting each other', async () => {
  const booking = await createCustomerBooking(await selection());
  const first = await Booking.findById(booking._id);
  const second = await Booking.findById(booking._id);
  addBookingPayment(first!, {
    id: 'one',
    amount: 400,
    method: 'cash',
    receivedAt: new Date(),
  });
  addBookingPayment(second!, {
    id: 'two',
    amount: 400,
    method: 'cash',
    receivedAt: new Date(),
  });
  const results = await Promise.allSettled([first!.save(), second!.save()]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((await Booking.findById(booking._id))?.amountPaid, 400);
});
test('500 demo reservations have consistent prices, receipts, dates, and no overlaps', async () => {
  await selection();
  const cabins = await Cabin.find();
  const settings = await Settings.getSettings();
  const inputs = buildDemoBookings(cabins, settings, ['customer']);
  assert.equal(inputs.length, 500);
  for (let i = 0; i < inputs.length; i++) {
    const doc = new Booking(inputs[i]);
    await doc.validate();
    assert.equal(doc.remainingAmount, doc.totalPrice - doc.amountPaid);
    assert.equal(doc.isPaid, doc.remainingAmount === 0);
    assert.equal(
      doc.payments.some(p => p.method === 'online' || p.paymentIntentId),
      false
    );
    if (i) assert.ok(inputs[i].checkInDate >= inputs[i - 1].checkOutDate);
  }
});

test('customer update conceals invalid, missing and foreign identities without writes', async () => {
  const booking = await createCustomerBooking(await selection());
  const bookingId = String(booking._id);
  const before = JSON.stringify(await Booking.findById(bookingId).lean());
  for (const attempt of [
    { id: 'invalid-id', customerId: 'customer' },
    { id: String(new mongoose.Types.ObjectId()), customerId: 'customer' },
    { id: bookingId, customerId: 'foreign' },
  ]) {
    await assert.rejects(
      updateCustomerBooking({
        bookingId: attempt.id,
        customerId: attempt.customerId,
        updates: { numGuests: 2 },
      }),
      (error: unknown) =>
        error instanceof BookingRuleError &&
        error.status === 404 &&
        error.message === 'Booking not found'
    );
    assert.equal(
      JSON.stringify(await Booking.findById(bookingId).lean()),
      before
    );
  }
});

test('customer update rejects terminal statuses without changing persisted data', async () => {
  const booking = await createCustomerBooking(await selection());
  const bookingId = String(booking._id);
  for (const status of ['checked-in', 'checked-out', 'cancelled'] as const) {
    booking.status = status;
    await booking.save();
    const before = JSON.stringify(await Booking.findById(bookingId).lean());
    await assert.rejects(
      updateCustomerBooking({
        bookingId: bookingId,
        customerId: 'customer',
        updates: { specialRequests: ['Extra towels'] },
      }),
      (error: unknown) =>
        error instanceof BookingRuleError &&
        error.status === 400 &&
        error.message === 'This booking can no longer be modified'
    );
    assert.equal(
      JSON.stringify(await Booking.findById(bookingId).lean()),
      before
    );
  }
});

test('paid customer updates permit special requests while preserving quote and receipt accounting', async () => {
  const booking = await createCustomerBooking(await selection());
  addBookingPayment(booking, {
    id: 'full-payment',
    amount: booking.totalPrice,
    method: 'cash',
    receivedAt: new Date('2030-05-01'),
  });
  await booking.save();
  const bookingId = String(booking._id);
  const before = await Booking.findById(bookingId).lean();
  assert.ok(before);
  await updateCustomerBooking({
    bookingId: bookingId,
    customerId: 'customer',
    updates: { specialRequests: ['Extra towels'] },
  });
  const after = await Booking.findById(bookingId).lean();
  assert.ok(after);
  assert.deepEqual(after.specialRequests, ['Extra towels']);
  assert.deepEqual(after.payments, before.payments);
  assert.equal(after.customer, before.customer);
  assert.equal(after.totalPrice, before.totalPrice);
  assert.equal(after.depositAmount, before.depositAmount);
  assert.equal(after.amountPaid, before.amountPaid);
  assert.equal(after.remainingAmount, before.remainingAmount);
  assert.equal(after.isPaid, true);
  assert.equal(after.depositPaid, true);
});
