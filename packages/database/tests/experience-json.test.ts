import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import mongoose, { type Model } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Experience } from '../src/models/Experience';
import {
  serializeExperience,
  type ExperienceJsonSource,
} from '../src/experience-json';

const reader: Model<ExperienceJsonSource> = Experience;
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

test('preserves hydrated defaults, lean omissions, nulls, dates and IDs', async () => {
  const id = new mongoose.Types.ObjectId();
  await Experience.collection.insertOne({
    _id: id,
    name: 'Forest walk',
    price: 25,
    duration: '2 hours',
    difficulty: 'Easy',
    category: 'Nature',
    description: 'Explore the forest',
    image: 'https://example.invalid/forest.jpg',
    ctaText: 'Book now',
    gallery: null,
    rating: null,
    location: null,
    updatedAt: null,
    createdAt: new Date('2030-06-01'),
    __v: 2,
  });
  const hydrated = await reader.findById(id).orFail();
  const lean = await reader.findById(id).lean().orFail();
  const before = json(lean);
  assert.deepEqual(json(serializeExperience(hydrated)), json(hydrated));
  assert.deepEqual(json(serializeExperience(lean)), before);
  assert.equal(Object.hasOwn(lean, 'includes'), false);
  assert.deepEqual(hydrated.includes, []);
  assert.deepEqual(json(lean), before);
});

test('array changes in transport output cannot mutate the source', () => {
  const source: ExperienceJsonSource = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Forest walk',
    price: 25,
    duration: '2 hours',
    difficulty: 'Easy',
    category: 'Nature',
    description: 'Explore the forest',
    image: 'https://example.invalid/forest.jpg',
    ctaText: 'Book now',
    includes: ['Guide'],
    available: ['Monday'],
    isPopular: true,
    gallery: ['forest.jpg'],
    tags: ['Nature'],
  };
  const output = serializeExperience(source);
  assert.deepEqual(json(output), json(source));
  output.includes?.push('Food');
  output.gallery?.push('river.jpg');
  assert.deepEqual(source.includes, ['Guide']);
  assert.deepEqual(source.gallery, ['forest.jpg']);
});
