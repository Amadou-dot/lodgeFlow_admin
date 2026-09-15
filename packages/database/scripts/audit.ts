/** Read-only audit: native driver reads; model validation never connects or writes. */
import mongoose from 'mongoose';
import {
  Booking,
  Cabin,
  Settings,
  Dining,
  Experience,
  DiningReservation,
  ExperienceBooking,
} from '../src';

async function audit() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');
  const client = new mongoose.mongo.MongoClient(uri, {
    serverSelectionTimeoutMS: 15000,
  });
  try {
    await client.connect();
    const db = client.db();
    const report: Record<
      string,
      { count: number; invalid: number; fields: Record<string, number> }
    > = {};
    for (const model of [
      Booking,
      Cabin,
      Settings,
      Dining,
      Experience,
      DiningReservation,
      ExperienceBooking,
    ]) {
      const entry = {
        count: 0,
        invalid: 0,
        fields: {} as Record<string, number>,
      };
      for await (const raw of db.collection(model.collection.name).find({})) {
        entry.count++;
        try {
          await model.hydrate(raw).validate();
        } catch (error) {
          entry.invalid++;
          const fields =
            error instanceof mongoose.Error.ValidationError
              ? Object.keys(error.errors)
              : ['validation'];
          for (const field of fields)
            entry.fields[field] = (entry.fields[field] ?? 0) + 1;
        }
      }
      report[model.modelName] = entry;
    }
    console.log(JSON.stringify(report, null, 2));
    if (Object.values(report).some(result => result.invalid > 0))
      process.exitCode = 1;
  } finally {
    await client.close();
  }
}
audit().catch(error => {
  console.error(
    error instanceof Error ? error.name + ': audit failed' : 'Audit failed'
  );
  process.exitCode = 1;
});
