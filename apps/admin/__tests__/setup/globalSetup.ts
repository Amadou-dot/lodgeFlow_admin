import { MongoMemoryReplSet } from 'mongodb-memory-server';

declare global {
  // Jest exposes globals set here to globalTeardown.
  var __MONGOD__: MongoMemoryReplSet | undefined;
}

export default async function globalSetup() {
  const mongod = await MongoMemoryReplSet.create();
  const uri = mongod.getUri();

  globalThis.__MONGOD__ = mongod;
  process.env.MONGODB_URI = uri;
}
