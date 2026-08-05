import mongoose from 'mongoose';

export async function clearCollection(collectionName: string): Promise<void> {
  const collection = mongoose.connection.collections[collectionName];
  if (collection) {
    await collection.deleteMany({});
  }
}

export async function clearAllCollections(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}

export async function getCollectionCount(
  collectionName: string
): Promise<number> {
  const collection = mongoose.connection.collections[collectionName];
  return collection ? collection.countDocuments() : 0;
}
