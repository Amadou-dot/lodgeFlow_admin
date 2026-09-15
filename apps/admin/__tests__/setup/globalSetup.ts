import { MongoMemoryReplSet } from 'mongodb-memory-server';

export default async function globalSetup() {
  const mongod = await MongoMemoryReplSet.create();
  const uri = mongod.getUri();

  (globalThis as any).__MONGOD__ = mongod;
  process.env.MONGODB_URI = uri;
}
