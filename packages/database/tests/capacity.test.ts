import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import {
  Dining,
  Experience,
  DiningReservation,
  ExperienceBooking,
  createDiningReservation,
  updateDiningReservation,
  createExperienceReservation,
  updateExperienceReservation,
  updateCapacityCatalog,
  deleteCapacityCatalog,
} from '../src';
let server: MongoMemoryReplSet;
before(async () => {
  server = await MongoMemoryReplSet.create();
  await mongoose.connect(server.getUri());
  await Promise.all([
    Dining.init(),
    Experience.init(),
    DiningReservation.init(),
    ExperienceBooking.init(),
  ]);
});
after(async () => {
  await mongoose.disconnect();
  await server.stop();
});
beforeEach(async () => {
  await Promise.all([
    Dining.deleteMany({}),
    Experience.deleteMany({}),
    DiningReservation.deleteMany({}),
    ExperienceBooking.deleteMany({}),
  ]);
});
const date = new Date('2030-06-01');
const diningSelection = { date, time: '18:00', numGuests: 2 };
async function dining() {
  return Dining.create({
    name: 'Dinner',
    description: 'Dinner test',
    price: 25,
    image: 'https://example.com/d.jpg',
    type: 'menu',
    mealType: 'dinner',
    category: 'regular',
    servingTime: { start: '17:00', end: '22:00' },
    maxPeople: 2,
    minPeople: 1,
  });
}
async function experience() {
  return Experience.create({
    name: 'Hiking',
    ctaText: 'Book now',
    description: 'Test hike',
    price: 50,
    duration: '2 hours',
    image: 'https://example.com/e.jpg',
    available: ['Monday'],
    difficulty: 'Easy',
    category: 'Outdoor',
    maxParticipants: 2,
  });
}
test('competing last-seat dining requests have exactly one winner on a replica set', async () => {
  const listing = await dining();
  const results = await Promise.allSettled(
    Array.from({ length: 6 }, (_, i) =>
      createDiningReservation({
        diningId: String(listing._id),
        customerId: `guest-${i}`,
        selection: diningSelection,
      })
    )
  );
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(await DiningReservation.countDocuments(), 1);
});
test('dining edits enforce capacity and cancellation releases seats', async () => {
  const listing = await dining();
  const id = String(listing._id);
  const one = await createDiningReservation({
    diningId: id,
    customerId: 'one',
    selection: {
      ...diningSelection,
      numGuests: 1,
    },
  });
  const two = await createDiningReservation({
    diningId: id,
    customerId: 'two',
    selection: {
      ...diningSelection,
      numGuests: 1,
    },
  });
  await assert.rejects(
    updateDiningReservation({
      reservationId: String(one._id),
      customerId: 'one',
      action: 'update',
      updates: { numGuests: 2 },
    })
  );
  await assert.rejects(
    updateDiningReservation({
      reservationId: String(one._id),
      customerId: 'someone-else',
      action: 'update',
      updates: { numGuests: 1 },
    })
  );
  await assert.rejects(
    updateDiningReservation({
      reservationId: String(one._id),
      customerId: 'one',
      action: 'update',
      updates: { numGuests: 0 },
    })
  );
  await updateDiningReservation({
    reservationId: String(two._id),
    customerId: 'two',
    action: 'cancel',
  });
  const updated = await updateDiningReservation({
    reservationId: String(one._id),
    customerId: 'one',
    action: 'update',
    updates: {
      numGuests: 2,
    },
  });
  assert.equal(updated.totalPrice, 50);
  await assert.rejects(updateCapacityCatalog('dining', id, { maxPeople: 1 }));
  await assert.rejects(deleteCapacityCatalog('dining', id));
});
test('moving two parties to the same final dining slot cannot oversell', async () => {
  const listing = await dining();
  const id = String(listing._id);
  const one = await createDiningReservation({
    diningId: id,
    customerId: 'one',
    selection: {
      ...diningSelection,
      time: '19:00',
    },
  });
  const two = await createDiningReservation({
    diningId: id,
    customerId: 'two',
    selection: {
      ...diningSelection,
      time: '20:00',
    },
  });
  const results = await Promise.allSettled([
    updateDiningReservation({
      reservationId: String(one._id),
      customerId: 'one',
      action: 'update',
      updates: { time: '18:00' },
    }),
    updateDiningReservation({
      reservationId: String(two._id),
      customerId: 'two',
      action: 'update',
      updates: { time: '18:00' },
    }),
  ]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
});
test('experience creation and edits share the daily capacity limit', async () => {
  const listing = await experience();
  const id = String(listing._id);
  const results = await Promise.allSettled(
    Array.from({ length: 5 }, (_, i) =>
      createExperienceReservation({
        experienceId: id,
        customerId: `guest-${i}`,
        selection: {
          date,
          numParticipants: 2,
          timeSlot: String(i),
        },
      })
    )
  );
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  const booking = await ExperienceBooking.findOne();
  await assert.rejects(
    updateExperienceReservation({
      reservationId: String(booking._id),
      customerId: booking.customer,
      action: 'update',
      updates: {
        numParticipants: 3,
      },
    })
  );
  await assert.rejects(
    updateCapacityCatalog('experience', id, { maxParticipants: 1 })
  );
  await updateExperienceReservation({
    reservationId: String(booking._id),
    customerId: booking.customer,
    action: 'cancel',
  });
  const fresh = await createExperienceReservation({
    experienceId: id,
    customerId: 'new',
    selection: {
      date,
      numParticipants: 1,
    },
  });
  const updated = await updateExperienceReservation({
    reservationId: String(fresh._id),
    customerId: 'new',
    action: 'update',
    updates: {
      numParticipants: 2,
    },
  });
  assert.equal(updated.totalPrice, 100);
});
test('simultaneous capacity reduction and reservation creation preserve the capacity invariant', async () => {
  const listing = await dining();
  const id = String(listing._id);
  await Promise.allSettled([
    updateCapacityCatalog('dining', id, { maxPeople: 1 }),
    createDiningReservation({
      diningId: id,
      customerId: 'guest',
      selection: diningSelection,
    }),
  ]);
  const saved = await Dining.findById(id);
  const rows = await DiningReservation.find();
  assert.ok(
    rows.reduce((sum, row) => sum + row.numGuests, 0) <= saved!.maxPeople
  );
});
