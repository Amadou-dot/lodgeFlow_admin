import assert from 'node:assert/strict';
import test from 'node:test';
import { faker } from '@faker-js/faker';
import {
  Booking,
  Cabin,
  Dining,
  Experience,
  Settings,
} from '@lodgeflow/database';
import {
  createBookingInput,
  createCabinInput,
  createDiningInput,
  createExperienceInput,
  createMockClerkUser,
  createSettingsInput,
} from './factories';

test('seeded factory defaults satisfy the real schemas, dates and paid receipt', async () => {
  faker.seed(6);
  const reference = new Date('2026-11-24T14:00:00Z');
  faker.setDefaultRefDate(reference);
  const cabin = new Cabin(createCabinInput());
  const booking = new Booking(
    createBookingInput({ cabin: cabin._id, isPaid: true, totalPrice: 125 })
  );
  await Promise.all([
    cabin.validate(),
    booking.validate(),
    new Dining(createDiningInput()).validate(),
    new Experience(createExperienceInput()).validate(),
    new Settings(createSettingsInput()).validate(),
  ]);
  assert.ok(booking.checkInDate > reference);
  assert.ok(booking.checkInDate <= new Date('2027-05-25T14:00:00Z'));
  const checkout = new Date(booking.checkInDate);
  assert.ok(booking.numNights >= 1 && booking.numNights <= 7);
  checkout.setDate(checkout.getDate() + booking.numNights);
  assert.deepEqual(booking.checkOutDate, checkout);
  assert.equal(booking.amountPaid, 125);
  assert.equal(booking.payments.length, 1);
  assert.equal(booking.payments[0].amount, 125);
  const user = createMockClerkUser();
  assert.equal(user.primaryEmailAddressId, user.emailAddresses[0].id);
});
