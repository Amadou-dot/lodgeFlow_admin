import mongoose from 'mongoose';
import { createClerkClient } from '@clerk/backend';
import {
  Booking,
  Cabin,
  Dining,
  Experience,
  Settings,
  DiningReservation,
  ExperienceBooking,
  buildDemoBookings,
} from '@lodgeflow/database';
import {
  cabinData,
  diningData,
  experienceData,
  settingsData,
} from './data/seed-data';
import connectDB from './mongodb';

export async function seedDatabase() {
  if (!process.env.CLERK_SECRET_KEY)
    throw new Error('CLERK_SECRET_KEY is not defined');
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const customers: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const response = await clerk.users.getUserList({ limit: 100, offset });
    customers.push(...response.data.map(user => user.id));
    if (response.data.length < 100) break;
  }
  return replaceDemoData(customers);
}

export async function replaceDemoData(customers: string[]) {
  await connectDB();
  const settings = new Settings(settingsData);
  const cabins = cabinData.map(input => new Cabin(input));
  const dining = diningData.map(input => new Dining(input));
  const experiences = experienceData.map(input => new Experience(input));
  const bookings = buildDemoBookings(cabins, settings, customers).map(
    input => new Booking(input)
  );
  await Promise.all(
    [settings, ...cabins, ...dining, ...experiences, ...bookings].map(doc =>
      doc.validate()
    )
  );
  // Validate everything before replacing data. A failed write rolls back the entire reset.
  await Promise.all([
    Settings.init(),
    Cabin.init(),
    Dining.init(),
    Experience.init(),
    Booking.init(),
    DiningReservation.init(),
    ExperienceBooking.init(),
  ]);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const model of [
        Booking,
        DiningReservation,
        ExperienceBooking,
        Cabin,
        Dining,
        Experience,
        Settings,
      ]) {
        await model.collection.deleteMany({}, { session });
      }
      await Settings.create([settings.toObject()], { session });
      await Cabin.insertMany(
        cabins.map(doc => doc.toObject()),
        { session }
      );
      await Dining.insertMany(
        dining.map(doc => doc.toObject()),
        { session }
      );
      await Experience.insertMany(
        experiences.map(doc => doc.toObject()),
        { session }
      );
      if (bookings.length)
        await Booking.insertMany(
          bookings.map(doc => doc.toObject()),
          { session }
        );
    });
  } finally {
    await session.endSession();
  }
  return {
    cabins: cabins.length,
    dining: dining.length,
    experiences: experiences.length,
    settings: 1,
    bookings: bookings.length,
    clerkUsers: customers.length,
  };
}
