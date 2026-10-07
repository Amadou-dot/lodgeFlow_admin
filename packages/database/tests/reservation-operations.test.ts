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
  ReservationRuleError,
} from '../src';
import type { ReservationPaymentState } from '../src/reservation-payment-state';
import type { IDiningReservation } from '../src/models/DiningReservation';
import type { IExperienceBooking } from '../src/models/ExperienceBooking';

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
type Identity = { reservationId: string; customerId: string };
type StateChanges = Partial<ReservationPaymentState> & {
  isPaid?: boolean;
  status?: IDiningReservation['status'] | IExperienceBooking['status'];
};
const resources = [
  {
    kind: 'dining',
    async create() {
      const listing = await Dining.create({
        name: 'Dinner',
        description: 'Dinner fixture',
        price: 25,
        image: 'https://example.invalid/dinner.jpg',
        type: 'menu',
        mealType: 'dinner',
        category: 'regular',
        servingTime: { start: '17:00', end: '22:00' },
        minPeople: 1,
        maxPeople: 2,
      });
      return createDiningReservation({
        diningId: String(listing._id),
        customerId: 'owner',
        selection: {
          date,
          time: '18:00',
          numGuests: 1,
        },
      });
    },
    reprice: ({ reservationId, customerId }: Identity) =>
      updateDiningReservation({
        reservationId: reservationId,
        customerId: customerId,
        action: 'update',
        updates: { numGuests: 2 },
      }),
    note: ({ reservationId, customerId }: Identity) =>
      updateDiningReservation({
        reservationId: reservationId,
        customerId: customerId,
        action: 'update',
        updates: {
          specialRequests: ['Window please'],
        },
      }),
    cancel: ({ reservationId, customerId }: Identity) =>
      updateDiningReservation({
        reservationId: reservationId,
        customerId: customerId,
        action: 'cancel',
      }),
    setState: ({
      reservationId,
      changes,
    }: {
      reservationId: string;
      changes: StateChanges;
    }) =>
      DiningReservation.updateOne({ _id: reservationId }, { $set: changes }),
    terminal: ['cancelled', 'completed', 'no-show'],
    total: 25,
  },
  {
    kind: 'experience',
    async create() {
      const listing = await Experience.create({
        name: 'Hiking',
        description: 'Hike fixture',
        price: 50,
        image: 'https://example.invalid/hiking.jpg',
        duration: '2 hours',
        difficulty: 'Easy',
        category: 'Outdoor',
        available: ['Monday'],
        includes: [],
        ctaText: 'Book now',
        maxParticipants: 2,
      });
      return createExperienceReservation({
        experienceId: String(listing._id),
        customerId: 'owner',
        selection: {
          date,
          numParticipants: 1,
          timeSlot: '18:00',
        },
      });
    },
    reprice: ({ reservationId, customerId }: Identity) =>
      updateExperienceReservation({
        reservationId: reservationId,
        customerId: customerId,
        action: 'update',
        updates: {
          numParticipants: 2,
        },
      }),
    note: ({ reservationId, customerId }: Identity) =>
      updateExperienceReservation({
        reservationId: reservationId,
        customerId: customerId,
        action: 'update',
        updates: {
          specialRequests: ['Window please'],
        },
      }),
    cancel: ({ reservationId, customerId }: Identity) =>
      updateExperienceReservation({
        reservationId: reservationId,
        customerId: customerId,
        action: 'cancel',
      }),
    setState: ({
      reservationId,
      changes,
    }: {
      reservationId: string;
      changes: StateChanges;
    }) =>
      ExperienceBooking.updateOne({ _id: reservationId }, { $set: changes }),
    terminal: ['cancelled', 'completed'],
    total: 50,
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
const payment = {
  id: 'fixture-payment',
  type: 'payment',
  amountCents: 1000,
  method: 'cash',
  reference: 'Fixture',
  actor: 'staff',
  recordedAt: date,
} satisfies ReservationPaymentState['receipts'][number];

for (const resource of resources) {
  test(`${resource.kind}: missing and foreign owners cannot update or cancel or advance the catalog version`, async () => {
    const created = await resource.create();
    assert.ok(created instanceof mongoose.Document);
    assert.ok(created.populated(resource.kind));
    const beforeState = await snapshot();
    for (const identity of [
      { reservationId: String(created._id), customerId: 'foreign' },
      {
        reservationId: new mongoose.Types.ObjectId().toHexString(),
        customerId: 'owner',
      },
    ]) {
      for (const operation of [resource.reprice, resource.cancel])
        await assert.rejects(
          operation(identity),
          rule({ status: 404, message: 'Reservation not found' })
        );
    }
    assert.equal(await snapshot(), beforeState);
  });

  test(`${resource.kind}: unpaid edits recalculate price and cancellation preserves the saved selection`, async () => {
    const created = await resource.create();
    assert.ok(created);
    const identity = {
      reservationId: String(created._id),
      customerId: 'owner',
    };
    assert.equal(created.customer, 'owner');
    assert.equal(created.status, 'pending');
    assert.equal(created.totalPrice, resource.total);
    assert.equal(created.isPaid, false);
    const edited = await resource.reprice(identity);
    assert.ok(edited);
    assert.equal(edited.totalPrice, resource.total * 2);
    const noted = await resource.note(identity);
    assert.ok(noted);
    assert.deepEqual(Array.from(noted.specialRequests ?? []), [
      'Window please',
    ]);
    const cancelled = await resource.cancel(identity);
    assert.ok(cancelled);
    assert.equal(cancelled.status, 'cancelled');
    assert.equal(cancelled.totalPrice, resource.total * 2);
    assert.deepEqual(Array.from(cancelled.specialRequests ?? []), [
      'Window please',
    ]);
    assert.equal(cancelled.date.getTime(), date.getTime());
    assert.equal(cancelled.customer, 'owner');
    assert.equal(cancelled.isPaid, false);
    assert.equal(cancelled.receipts.length, 0);
    assert.ok(cancelled.populated(resource.kind));
  });

  test(`${resource.kind}: paid, pending and terminal guards roll back every rejected operation`, async () => {
    const cases: {
      changes: StateChanges;
      cancelMessage: string;
      updateMessage: string;
      status: number;
    }[] = [
      {
        changes: { isPaid: true },
        cancelMessage: 'Contact the property to cancel a paid reservation',
        updateMessage: 'Paid reservations cannot be repriced or moved',
        status: 409,
      },
      {
        changes: { receipts: [payment] },
        cancelMessage: 'Contact the property to cancel a paid reservation',
        updateMessage: 'Paid reservations cannot be repriced or moved',
        status: 409,
      },
      {
        changes: {
          checkout: {
            token: 'quote',
            amountCents: 1000,
            currency: 'usd',
            createdAt: date,
            pending: true,
          },
        },
        cancelMessage: 'An online transaction is pending',
        updateMessage: 'An online transaction is pending',
        status: 409,
      },
      {
        changes: {
          stripeRefund: {
            token: 'refund',
            amountCents: 1000,
            createdAt: date,
            status: 'pending',
            actor: 'staff',
            reference: 'Fixture',
          },
        },
        cancelMessage: 'An online transaction is pending',
        updateMessage: 'An online transaction is pending',
        status: 409,
      },
      ...resource.terminal.map(status => ({
        changes: { status },
        status: 400,
        cancelMessage: 'This reservation can no longer be changed',
        updateMessage: 'This reservation can no longer be changed',
      })),
    ];
    for (const scenario of cases) {
      const created = await resource.create();
      assert.ok(created);
      const identity = {
        reservationId: String(created._id),
        customerId: 'owner',
      };
      await resource.setState({
        reservationId: identity.reservationId,
        changes: scenario.changes,
      });
      const beforeState = await snapshot();
      await assert.rejects(
        resource.cancel(identity),
        rule({ status: scenario.status, message: scenario.cancelMessage })
      );
      await assert.rejects(
        resource.reprice(identity),
        rule({ status: scenario.status, message: scenario.updateMessage })
      );
      assert.equal(await snapshot(), beforeState);
    }
  });

  test(`${resource.kind}: note edits on a partially paid reservation retain receipts and price`, async () => {
    const created = await resource.create();
    assert.ok(created);
    const identity = {
      reservationId: String(created._id),
      customerId: 'owner',
    };
    await resource.setState({
      reservationId: identity.reservationId,
      changes: { receipts: [payment] },
    });
    const edited = await resource.note(identity);
    assert.ok(edited);
    assert.equal(edited.totalPrice, resource.total);
    assert.equal(edited.isPaid, false);
    assert.equal(edited.status, 'pending');
    assert.deepEqual(JSON.parse(JSON.stringify(edited.receipts)), [
      { ...payment, recordedAt: date.toISOString() },
    ]);
    assert.deepEqual(Array.from(edited.specialRequests ?? []), [
      'Window please',
    ]);
  });
}
