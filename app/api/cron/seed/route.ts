import { timingSafeEqual } from 'node:crypto';
import {
  cabinData,
  diningData,
  experienceData,
  settingsData,
} from '@/lib/data/seed-data';
import connectDB from '@/lib/mongodb';
import { Booking, Cabin, Dining, Experience, Settings } from '@/models';
import { createClerkClient } from '@clerk/backend';
import { faker } from '@faker-js/faker';
import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic'; // Ensure the route is not cached

function getBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token, ...rest] = authorizationHeader.trim().split(/\s+/);

  if (scheme?.toLowerCase() !== 'bearer' || !token || rest.length > 0) {
    return null;
  }

  return token;
}

function isAuthorizedSeedRequest(
  seedSecret: string,
  authorizationHeader: string | null
): boolean {
  const bearerToken = getBearerToken(authorizationHeader);

  if (!bearerToken) {
    return false;
  }

  const expectedSecret = Buffer.from(seedSecret);
  const receivedToken = Buffer.from(bearerToken);

  return (
    expectedSecret.length === receivedToken.length &&
    timingSafeEqual(expectedSecret, receivedToken)
  );
}

export async function GET(request: Request) {
  try {
    const seedSecret = process.env.SEED_SECRET;

    if (!seedSecret) {
      console.error('SEED_SECRET is not configured for /api/cron/seed');
      return NextResponse.json(
        {
          success: false,
          error: 'SEED_SECRET is not configured',
        },
        { status: 500 }
      );
    }

    if (
      !isAuthorizedSeedRequest(seedSecret, request.headers.get('authorization'))
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        {
          status: 401,
          headers: {
            'WWW-Authenticate': 'Bearer',
          },
        }
      );
    }

    await connectDB();

    // 1. Clear all existing data
    await Promise.all([
      Cabin.deleteMany({}),
      Booking.deleteMany({}),
      Settings.deleteMany({}),
      Experience.deleteMany({}),
      Dining.deleteMany({}),
    ]);

    // 2. Re-seed static data
    const settings = await Settings.create(settingsData);
    const cabins = await Cabin.insertMany(cabinData);
    await Experience.insertMany(experienceData);
    await Dining.insertMany(diningData);

    // 3. Fetch Users from Clerk
    if (!process.env.CLERK_SECRET_KEY) {
      throw new Error('CLERK_SECRET_KEY is not defined');
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
      return NextResponse.json({
        success: true,
        message:
          'Database seeded (no Clerk users found, skipped booking creation)',
        results: {
          cabins: cabins.length,
          experiences: experienceData.length,
          dining: diningData.length,
          settings: 1,
          bookings: 0,
        },
      });
    }

    // 4. Create bookings with recent dates
    const today = new Date();
    const sixtyDaysAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);
    const thirtyDaysFromNow = new Date(
      today.getTime() + 30 * 24 * 60 * 60 * 1000
    );

    const newBookings = [];

    for (let i = 0; i < 500; i++) {
      const cabin = faker.helpers.arrayElement(cabins);
      const clerkUserId = faker.helpers.arrayElement(clerkUserIds);

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

      const bookingCreatedAt = faker.date.between({
        from: sixtyDaysAgo,
        to: new Date(Math.min(checkInDate.getTime(), Date.now())),
      });

      const booking = await Booking.create({
        cabin: cabin._id,
        customer: clerkUserId,
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

      newBookings.push(booking);
    }

    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully',
      results: {
        cabins: cabins.length,
        experiences: experienceData.length,
        dining: diningData.length,
        settings: 1,
        clerkUsers: clerkUserIds.length,
        bookings: newBookings.length,
      },
    });
  } catch (error: unknown) {
    console.error('Error seeding database:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
