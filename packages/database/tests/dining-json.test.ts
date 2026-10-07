import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import mongoose, { type Model } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Dining from '../src/models/Dining';
import { serializeDining, type DiningJsonSource } from '../src/dining-json';

const reader: Model<DiningJsonSource> = Dining;
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

test('matches hydrated and lean JSON without inventing lean defaults or losing nested IDs/nulls', async () => {
  const id = new mongoose.Types.ObjectId();
  await Dining.collection.insertOne({
    _id: id,
    name: 'Sparse dinner',
    description: 'Legacy fixture',
    type: 'menu',
    mealType: 'dinner',
    category: 'regular',
    price: 25,
    maxPeople: 4,
    servingTime: { start: '17:00', end: '22:00' },
    image: 'https://example.invalid/dinner.jpg',
    location: null,
    rating: null,
    gallery: null,
    updatedAt: null,
    beverages: [
      {
        _id: new mongoose.Types.ObjectId(),
        name: 'Juice',
        category: 'non-alcoholic',
        price: null,
      },
    ],
  });
  const hydrated = await reader.findById(id).orFail();
  const lean = await reader.findById(id).lean().orFail();
  const before = json(lean);
  assert.deepEqual(json(serializeDining(hydrated)), json(hydrated));
  assert.deepEqual(json(serializeDining(lean)), before);
  assert.deepEqual(json(lean), before);
  assert.equal(Object.hasOwn(lean, 'minPeople'), false);
  assert.equal(hydrated.minPeople, 1);
});

test('nested arrays and objects are copied rather than exposing document mutation', () => {
  const source: DiningJsonSource = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Dinner',
    description: 'Fixture',
    type: 'menu',
    mealType: 'dinner',
    category: 'regular',
    price: 25,
    maxPeople: 4,
    minPeople: 1,
    servingTime: { start: '17:00', end: '22:00' },
    image: 'https://example.invalid/dinner.jpg',
    isAvailable: true,
    isPopular: false,
    gallery: ['one.jpg'],
    beverages: [
      {
        _id: new mongoose.Types.ObjectId(),
        name: 'Juice',
        category: 'non-alcoholic',
      },
    ],
    createdAt: new Date('2030-06-01'),
    __v: 3,
  };
  const output = serializeDining(source);
  assert.deepEqual(json(output), json(source));
  output.gallery?.push('two.jpg');
  output.servingTime.start = '18:00';
  if (output.beverages?.[0]) output.beverages[0].name = 'Tea';
  assert.deepEqual(source.gallery, ['one.jpg']);
  assert.equal(source.servingTime.start, '17:00');
  assert.equal(source.beverages?.[0].name, 'Juice');
});
