export default async function globalTeardown() {
  const mongod = globalThis.__MONGOD__;
  if (mongod) {
    await mongod.stop();
  }
}
