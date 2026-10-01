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
  createExperienceReservation,
  updateCapacityCatalog,
  deleteCapacityCatalog,
  ReservationRuleError,
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
const date = new Date('2030-06-01T18:00:00Z');
type ReferenceInput = {
  listingId: string;
  slot: string;
  status?: 'pending' | 'cancelled';
  date?: Date;
};
const resources = [
  {
    kind: 'dining',
    catalog: Dining,
    reservations: DiningReservation,
    async create() {
      return Dining.create({
        name: 'Dinner',
        description: 'Catalog operation fixture',
        price: 25,
        image: 'https://example.invalid/dinner.jpg',
        type: 'menu',
        mealType: 'dinner',
        category: 'regular',
        servingTime: { start: '17:00', end: '22:00' },
        minPeople: 1,
        maxPeople: 4,
        isPopular: true,
      });
    },
    reference: (input: ReferenceInput) =>
      DiningReservation.create({
        dining: input.listingId,
        customer: 'owner',
        date: input.date ?? date,
        time: input.slot,
        numGuests: 2,
        totalPrice: 50,
        status: input.status ?? 'pending',
      }),
    reserve: (listingId: string) =>
      createDiningReservation({
        diningId: listingId,
        customerId: 'owner',
        selection: { date, time: '18:00', numGuests: 2 },
      }),
    reduce: (listingId: string) =>
      updateCapacityCatalog({
        kind: 'dining',
        listingId,
        updates: { maxPeople: 1, name: 'Must roll back' },
      }),
  },
  {
    kind: 'experience',
    catalog: Experience,
    reservations: ExperienceBooking,
    async create() {
      return Experience.create({
        name: 'Hiking',
        description: 'Catalog operation fixture',
        price: 50,
        image: 'https://example.invalid/hike.jpg',
        duration: '2 hours',
        difficulty: 'Easy',
        category: 'Outdoor',
        available: ['Monday'],
        includes: [],
        ctaText: 'Book now',
        maxParticipants: 4,
        isPopular: true,
      });
    },
    reference: (input: ReferenceInput) =>
      ExperienceBooking.create({
        experience: input.listingId,
        customer: 'owner',
        date: input.date ?? date,
        timeSlot: input.slot,
        numParticipants: 2,
        totalPrice: 100,
        status: input.status ?? 'pending',
      }),
    reserve: (listingId: string) =>
      createExperienceReservation({
        experienceId: listingId,
        customerId: 'owner',
        selection: { date, timeSlot: '18:00', numParticipants: 2 },
      }),
    reduce: (listingId: string) =>
      updateCapacityCatalog({
        kind: 'experience',
        listingId,
        updates: { maxParticipants: 1, name: 'Must roll back' },
      }),
  },
] as const;
async function snapshot() {
  return JSON.stringify(
    await Promise.all([
      Dining.find().select('+reservationVersion').sort({ _id: 1 }).lean(),
      Experience.find().select('+reservationVersion').sort({ _id: 1 }).lean(),
      DiningReservation.find().sort({ _id: 1 }).lean(),
      ExperienceBooking.find().sort({ _id: 1 }).lean(),
    ])
  );
}
function rule({ status, message }: { status: number; message: string }) {
  return (error: unknown) =>
    error instanceof ReservationRuleError &&
    error.status === status &&
    error.message === message;
}
for (const resource of resources) {
  test(`${resource.kind}: unused listing deletion returns its document and removes only that listing`, async () => {
    const listing = await resource.create();
    const other = await resource.create();
    const removed = await deleteCapacityCatalog({
      kind: resource.kind,
      listingId: String(listing._id),
    });
    assert.ok(removed instanceof mongoose.Document);
    assert.equal(String(removed._id), String(listing._id));
    assert.equal(await resource.catalog.findById(listing._id), null);
    assert.ok(await resource.catalog.exists({ _id: other._id }));
  });
  test(`${resource.kind}: cancelled historical references block deletion without advancing the version`, async () => {
    const listing = await resource.create();
    const listingId = String(listing._id);
    await resource.reference({
      listingId,
      slot: '18:00',
      status: 'cancelled',
      date: new Date('2000-01-01'),
    });
    const beforeState = await snapshot();
    await assert.rejects(
      deleteCapacityCatalog({ kind: resource.kind, listingId }),
      rule({
        status: 409,
        message: 'Cannot delete a listing referenced by reservation history',
      })
    );
    assert.equal(await snapshot(), beforeState);
  });
  test(`${resource.kind}: rejected capacity edits roll back all fields and the contention version`, async () => {
    const listing = await resource.create();
    const listingId = String(listing._id);
    await resource.reference({ listingId, slot: '18:00' });
    const beforeState = await snapshot();
    await assert.rejects(
      resource.reduce(listingId),
      rule({
        status: 409,
        message: 'Capacity cannot be reduced below existing reservations',
      })
    );
    assert.equal(await snapshot(), beforeState);
  });
  test(`${resource.kind}: partial catalog edits retain omitted fields and never reprice saved reservations`, async () => {
    const listing = await resource.create();
    const listingId = String(listing._id);
    await resource.reference({ listingId, slot: '18:00' });
    const beforeRows = JSON.stringify(
      await resource.reservations.find().lean()
    );
    const updated = await updateCapacityCatalog({
      kind: resource.kind,
      listingId,
      updates: { name: 'Renamed', price: 12.5 },
    });
    assert.ok(updated instanceof mongoose.Document);
    assert.equal(updated.name, 'Renamed');
    assert.equal(updated.price, 12.5);
    assert.equal(updated.isPopular, true);
    assert.equal(
      JSON.stringify(await resource.reservations.find().lean()),
      beforeRows
    );
  });
  test(`${resource.kind}: concurrent creation and deletion cannot leave an orphan reservation`, async () => {
    const listing = await resource.create();
    const listingId = String(listing._id);
    const results = await Promise.allSettled([
      resource.reserve(listingId),
      deleteCapacityCatalog({ kind: resource.kind, listingId }),
    ]);
    assert.equal(
      results.filter(result => result.status === 'fulfilled').length,
      1
    );
    assert.equal(
      await resource.catalog.countDocuments(),
      await resource.reservations.countDocuments()
    );
  });
}
test('dining serving hours and party-size edits reject conflicts without writes', async () => {
  const resource = resources[0];
  const listing = await resource.create();
  const listingId = String(listing._id);
  await resource.reference({ listingId, slot: '18:00' });
  for (const updates of [
    { minPeople: 3 },
    { servingTime: { start: '19:00', end: '22:00' } },
  ]) {
    const beforeState = await snapshot();
    await assert.rejects(
      updateCapacityCatalog({ kind: 'dining', listingId, updates }),
      rule({
        status: 409,
        message:
          'Existing reservations conflict with the new party size or serving hours',
      })
    );
    assert.equal(await snapshot(), beforeState);
  }
});
test('catalog capacity remains per dining seating and per experience day across time slots', async () => {
  for (const resource of resources) {
    const listing = await resource.create();
    const listingId = String(listing._id);
    await resource.reference({ listingId, slot: '18:00' });
    await resource.reference({ listingId, slot: '19:00' });
    if (resource.kind === 'dining') {
      const updated = await updateCapacityCatalog({
        kind: 'dining',
        listingId,
        updates: { maxPeople: 2 },
      });
      assert.ok('maxPeople' in updated);
      assert.equal(updated.maxPeople, 2);
    } else {
      const beforeState = await snapshot();
      await assert.rejects(
        updateCapacityCatalog({
          kind: 'experience',
          listingId,
          updates: { maxParticipants: 2 },
        }),
        rule({
          status: 409,
          message: 'Capacity cannot be reduced below existing reservations',
        })
      );
      assert.equal(await snapshot(), beforeState);
    }
  }
});
