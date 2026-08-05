export default async function globalTeardown() {
  const mongod = (globalThis as any).__MONGOD__;
  if (mongod) {
    await mongod.stop();
  }
}
