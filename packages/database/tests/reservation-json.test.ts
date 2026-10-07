import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import DiningReservation from '../src/models/DiningReservation';
import ExperienceBooking from '../src/models/ExperienceBooking';
import {
  serializeDiningReservation,
  serializeExperienceReservation,
  serializeUnpopulatedReservation,
} from '../src/reservation-json';
let server: MongoMemoryServer;
before(async () => {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri());
});
after(async () => {
  await mongoose.disconnect();
  await server.stop();
});
function json(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

test('reservation JSON preserves hydrated virtuals, lean omissions, legacy nulls and nested payment dates', async () => {
  const date = new Date('2030-06-01');
  const common = {
    customer: 'guest',
    date,
    totalPrice: 25,
    isPaid: false,
    checkout: null,
    stripeRefund: null,
    specialRequests: null,
    paymentConfirmationSentAt: null,
    createdAt: date,
    updatedAt: date,
    __v: 2,
  };
  const diningId = new mongoose.Types.ObjectId(),
    experienceId = new mongoose.Types.ObjectId();
  await DiningReservation.collection.insertOne({
    ...common,
    _id: diningId,
    dining: new mongoose.Types.ObjectId(),
    time: '19:00',
    numGuests: 1,
    status: 'seated',
  });
  await ExperienceBooking.collection.insertOne({
    ...common,
    _id: experienceId,
    experience: new mongoose.Types.ObjectId(),
    numParticipants: 1,
    status: 'confirmed',
    receipts: [
      {
        id: 'receipt',
        type: 'payment',
        method: 'cash',
        amountCents: 100,
        actor: 'staff',
        reference: '',
        recordedAt: date,
      },
    ],
  });
  const dining = await DiningReservation.findById(diningId).orFail();
  const experience = await ExperienceBooking.findById(experienceId).orFail();
  assert.deepEqual(json(serializeUnpopulatedReservation(dining)), json(dining));
  assert.deepEqual(
    json(serializeUnpopulatedReservation(experience)),
    json(experience)
  );
  const leanDining = await DiningReservation.findById(diningId).lean().orFail();
  const leanExperience = await ExperienceBooking.findById(experienceId)
    .lean()
    .orFail();
  const before = json(leanExperience);
  assert.deepEqual(
    json(
      serializeDiningReservation({
        reservation: leanDining,
        dining: leanDining.dining.toHexString(),
      })
    ),
    json(leanDining)
  );
  const output = serializeExperienceReservation({
    reservation: leanExperience,
    experience: leanExperience.experience.toHexString(),
  });
  assert.deepEqual(json(output), before);
  assert.equal(Object.hasOwn(leanDining, 'receipts'), false);
  assert.equal(Object.hasOwn(leanExperience, 'id'), false);
  assert.ok(output.receipts);
  output.receipts[0].reference = 'changed';
  assert.deepEqual(json(leanExperience), before);
});
