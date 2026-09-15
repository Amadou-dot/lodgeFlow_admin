/** Read-only audit: native driver reads; model validation never connects or writes. */
import mongoose from 'mongoose';
import {
  Booking,
  paymentSummary,
  type BookingPayment,
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
    const bookings = await db
      .collection(Booking.collection.name)
      .find({})
      .toArray();
    const cabinIds = new Set(
      (
        await db
          .collection(Cabin.collection.name)
          .find({}, { projection: { _id: 1 } })
          .toArray()
      ).map(c => String(c._id))
    );
    const accounting = {
      inconsistent: 0,
      missingCabin: 0,
      overlapping: 0,
      invalidReceipts: 0,
    };
    const occupiedUntil = new Map<string, number>();
    for (const booking of bookings.sort(
      (a, b) => a.checkInDate.getTime() - b.checkInDate.getTime()
    )) {
      const payments = (booking.payments ?? []) as BookingPayment[];
      const summary = paymentSummary(
        booking.totalPrice,
        booking.depositAmount,
        payments
      );
      if (
        Object.entries(summary).some(([key, value]) => booking[key] !== value)
      )
        accounting.inconsistent++;
      if (!cabinIds.has(String(booking.cabin))) accounting.missingCabin++;
      if (
        new Set(payments.map(p => p.id)).size !== payments.length ||
        payments.some(
          p =>
            !p.id ||
            p.amount <= 0 ||
            (p.refundedAmount ?? 0) > p.amount ||
            (p.method === 'online' && !p.paymentIntentId)
        )
      )
        accounting.invalidReceipts++;
      if (booking.status !== 'cancelled') {
        const cabin = String(booking.cabin);
        if ((occupiedUntil.get(cabin) ?? 0) > booking.checkInDate.getTime())
          accounting.overlapping++;
        occupiedUntil.set(
          cabin,
          Math.max(
            occupiedUntil.get(cabin) ?? 0,
            booking.checkOutDate.getTime()
          )
        );
      }
    }
    const indexes = await db.collection(Booking.collection.name).indexes();
    const overlapIndex = indexes.find(
      index => index.name === 'cabin_1_checkInDate_1_checkOutDate_1'
    );
    const overlapIndexValid =
      !!overlapIndex && !overlapIndex.partialFilterExpression;
    console.log(
      JSON.stringify({ models: report, accounting, overlapIndexValid }, null, 2)
    );
    if (
      Object.values(report).some(result => result.invalid > 0) ||
      Object.values(accounting).some(count => count > 0) ||
      !overlapIndexValid
    )
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
