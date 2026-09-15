import { createClerkClient } from '@clerk/backend';
import { faker } from '@faker-js/faker';
import { config } from 'dotenv';
import { resolve } from 'path';
import {
  cabinData,
  diningData,
  experienceData,
  settingsData,
} from '../lib/data/seed-data';
import connectDB from '../lib/mongodb';
import type { IBooking, IExperience } from '../models';
import { Booking, Cabin, Dining, Experience, Settings } from '../models';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');

    // Connect to database
    await connectDB();
    console.log('✅ Database connected');

    // Clear existing data
    await Promise.all([
      Cabin.deleteMany({}),
      Booking.deleteMany({}),
      Settings.deleteMany({}),
      Experience.deleteMany({}),
      Dining.deleteMany({}),
    ]);
    console.log('🗑️  Cleared existing data');

    // Create settings
    const settings = await Settings.create(settingsData);
    console.log('⚙️  Settings created');

    // Create cabins
    const cabins = await Cabin.insertMany(cabinData as any);
    console.log(`🏠 Created ${cabins.length} cabins`);

    // Create experiences
    const experiences: IExperience[] =
      await Experience.insertMany(experienceData);
    console.log(`🎯 Created ${experiences.length} experiences`);

    // Create dining items
    const dining = await Dining.insertMany(diningData as any);
    console.log(`🍽️ Created ${dining.length} dining items`);

    // Fetch existing Clerk users to associate with bookings.
    // Run `pnpm clerk:users` first if you need to populate Clerk with test users.
    if (!process.env.CLERK_SECRET_KEY) {
      throw new Error('CLERK_SECRET_KEY is not set');
    }
    const clerkClient = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    const clerkUserIds: string[] = [];
    let offset = 0;
    const limit = 100;
    while (true) {
      const response = await clerkClient.users.getUserList({ limit, offset });
      clerkUserIds.push(...response.data.map(u => u.id));
      if (response.data.length < limit) break;
      offset += limit;
    }

    if (clerkUserIds.length === 0) {
      console.warn(
        '⚠️  No Clerk users found — skipping booking creation. Run `pnpm clerk:users` first.'
      );
    } else {
      console.log(`👥 Found ${clerkUserIds.length} existing Clerk users`);
    }

    // Create bookings with recent dates (within last 60 days)
    const bookings: IBooking[] = [];

    if (clerkUserIds.length > 0) {
      const today = new Date();
      const sixtyDaysAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);
      const thirtyDaysFromNow = new Date(
        today.getTime() + 30 * 24 * 60 * 60 * 1000
      );

      for (let i = 0; i < 500; i++) {
        const cabin = faker.helpers.arrayElement(cabins);
        const clerkUserId = faker.helpers.arrayElement(clerkUserIds);

        // Generate check-in dates from 30 days ago to 30 days in the future
        const checkInDate = faker.date.between({
          from: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
          to: thirtyDaysFromNow,
        });
        const numNights = faker.number.int({ min: 2, max: 14 });
        const checkOutDate = new Date(checkInDate);
        checkOutDate.setDate(checkOutDate.getDate() + numNights);

        const discountedPrice =
          cabin.discount > 0 ? cabin.price - cabin.discount : cabin.price;
        const cabinPrice = discountedPrice * numNights;
        const hasBreakfast = faker.datatype.boolean();
        const hasPets = faker.datatype.boolean({ probability: 0.3 });
        const hasParking = faker.datatype.boolean({ probability: 0.4 });

        const breakfastPrice = hasBreakfast
          ? settings.breakfastPrice *
            faker.number.int({ min: 1, max: 4 }) *
            numNights
          : 0;
        const petFee = hasPets ? settings.petFee * numNights : 0;
        const parkingFee =
          hasParking && !settings.parkingIncluded
            ? settings.parkingFee * numNights
            : 0;

        const extrasPrice = breakfastPrice + petFee + parkingFee;
        const totalPrice = cabinPrice + extrasPrice;
        const depositAmount = settings.requireDeposit
          ? Math.round(totalPrice * (settings.depositPercentage / 100))
          : 0;

        // Create a realistic createdAt date (booking was made within last 60 days, before check-in)
        const bookingCreatedAt = faker.date.between({
          from: sixtyDaysAgo,
          to: new Date(Math.min(checkInDate.getTime(), Date.now())),
        });

        const booking = await Booking.create({
          cabin: cabin._id,
          customer: clerkUserId, // Using Clerk user ID instead of MongoDB customer ID
          checkInDate,
          checkOutDate,
          numNights,
          numGuests: faker.number.int({ min: 1, max: cabin.capacity }),
          status: faker.helpers.arrayElement([
            'unconfirmed',
            'confirmed',
            'checked-in',
            'checked-out',
            'cancelled',
          ]),
          cabinPrice: discountedPrice,
          extrasPrice,
          totalPrice,
          isPaid: faker.datatype.boolean({ probability: 0.7 }),
          paymentMethod: faker.helpers.arrayElement([
            'cash',
            'card',
            'bank-transfer',
            'online',
          ]),
          extras: {
            hasBreakfast,
            breakfastPrice,
            hasPets,
            petFee,
            hasParking,
            parkingFee,
            hasEarlyCheckIn: false,
            earlyCheckInFee: 0,
            hasLateCheckOut: false,
            lateCheckOutFee: 0,
          },
          observations: faker.datatype.boolean({ probability: 0.3 })
            ? faker.lorem.paragraph()
            : undefined,
          specialRequests: faker.datatype.boolean({ probability: 0.2 })
            ? faker.helpers.arrayElements(
                ['late checkout', 'early checkin', 'extra towels', 'baby crib'],
                { min: 1, max: 2 }
              )
            : [],
          depositPaid:
            depositAmount > 0
              ? faker.datatype.boolean({ probability: 0.8 })
              : false,
          depositAmount,
          createdAt: bookingCreatedAt,
        });

        bookings.push(booking);
      }
      console.log(`📅 Created ${bookings.length} bookings`);
    } // end if (clerkUserIds.length > 0)

    // NOTE: Customer statistics are no longer maintained in MongoDB
    // since users are managed by Clerk. Statistics can be calculated
    // on-demand by querying bookings with Clerk user IDs.

    console.log('🎉 Database seeding completed successfully!');
    console.log(`
📈 Summary:
- Settings: 1
- Cabins: ${cabins.length}
- Experiences: ${experiences.length}
- Dining Items: ${dining.length}
- Clerk Users (existing): ${clerkUserIds.length}
- Bookings: ${bookings.length}
${clerkUserIds.length === 0 ? '\n⚠️  No bookings created. Run `pnpm clerk:users` then re-seed to generate bookings.' : ''}
    `);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('✅ Seeding completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}

export default seedDatabase;
