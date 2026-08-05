import { faker } from '@faker-js/faker';
import mongoose from 'mongoose';

// ---- Cabin Factory ----
export function createCabinInput(overrides: Record<string, any> = {}) {
  return {
    name: faker.lorem.words(2) + ' Cabin',
    description: faker.lorem.sentence(10),
    capacity: faker.number.int({ min: 1, max: 10 }),
    price: faker.number.int({ min: 50, max: 500 }),
    discount: 0,
    image: `https://example.com/${faker.string.alphanumeric(10)}.jpg`,
    amenities: ['WiFi', 'Air Conditioning'],
    status: 'active' as const,
    ...overrides,
  };
}

// ---- Booking Factory ----
export function createBookingInput(overrides: Record<string, any> = {}) {
  const checkIn = faker.date.future({ years: 0.5 });
  const checkOut = new Date(checkIn);
  checkOut.setDate(checkOut.getDate() + faker.number.int({ min: 1, max: 7 }));
  const numNights = Math.ceil(
    (checkOut.getTime() - checkIn.getTime()) / (1000 * 3600 * 24)
  );
  const cabinPrice = faker.number.int({ min: 100, max: 500 }) * numNights;

  return {
    cabin: new mongoose.Types.ObjectId(),
    customer: `user_${faker.string.alphanumeric(10)}`,
    checkInDate: checkIn,
    checkOutDate: checkOut,
    numNights,
    numGuests: faker.number.int({ min: 1, max: 4 }),
    status: 'unconfirmed' as const,
    cabinPrice,
    extrasPrice: 0,
    totalPrice: cabinPrice,
    isPaid: false,
    extras: {
      hasBreakfast: false,
      breakfastPrice: 0,
      hasPets: false,
      petFee: 0,
      hasParking: false,
      parkingFee: 0,
      hasEarlyCheckIn: false,
      earlyCheckInFee: 0,
      hasLateCheckOut: false,
      lateCheckOutFee: 0,
    },
    depositPaid: false,
    depositAmount: 0,
    remainingAmount: cabinPrice,
    ...overrides,
  };
}

// ---- Dining Factory ----
export function createDiningInput(overrides: Record<string, any> = {}) {
  return {
    name: faker.lorem.words(3),
    description: faker.lorem.sentence(10),
    price: faker.number.float({ min: 5, max: 50, fractionDigits: 2 }),
    type: faker.helpers.arrayElement(['breakfast', 'lunch', 'dinner', 'snack']),
    mealType: faker.helpers.arrayElement(['starter', 'main', 'dessert']),
    category: faker.helpers.arrayElement([
      'appetizer',
      'main',
      'dessert',
      'beverage',
    ]),
    image: `https://example.com/${faker.string.alphanumeric(10)}.jpg`,
    isAvailable: true,
    ...overrides,
  };
}

// ---- Experience Factory ----
export function createExperienceInput(overrides: Record<string, any> = {}) {
  return {
    name: faker.lorem.words(3),
    description: faker.lorem.sentence(10),
    price: faker.number.int({ min: 20, max: 200 }),
    duration: `${faker.number.int({ min: 1, max: 8 })} hours`,
    difficulty: faker.helpers.arrayElement(['Easy', 'Moderate', 'Challenging']),
    maxParticipants: faker.number.int({ min: 2, max: 20 }),
    category: faker.lorem.word(),
    image: `https://example.com/${faker.string.alphanumeric(10)}.jpg`,
    available: true,
    ...overrides,
  };
}

// ---- Settings Factory ----
export function createSettingsInput(overrides: Record<string, any> = {}) {
  return {
    minBookingLength: 1,
    maxBookingLength: 30,
    maxGuestsPerBooking: 10,
    breakfastPrice: 15,
    checkInTime: '14:00',
    checkOutTime: '11:00',
    cancellationPolicy: 'moderate',
    requireDeposit: true,
    depositPercentage: 25,
    allowPets: false,
    petFee: 0,
    currency: 'USD',
    timezone: 'America/New_York',
    ...overrides,
  };
}

// ---- Mock Clerk User Factory ----
export function createMockClerkUser(overrides: Record<string, any> = {}) {
  const id = `user_${faker.string.alphanumeric(20)}`;
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();

  return {
    id,
    firstName,
    lastName,
    username: faker.internet.username(),
    emailAddresses: [
      {
        id: 'email_1',
        emailAddress: faker.internet.email({ firstName, lastName }),
      },
    ],
    primaryEmailAddressId: 'email_1',
    phoneNumbers: [{ phoneNumber: faker.phone.number() }],
    imageUrl: faker.image.avatar(),
    hasImage: true,
    publicMetadata: {},
    privateMetadata: {},
    createdAt: faker.date.past().getTime(),
    updatedAt: Date.now(),
    lastSignInAt: Date.now(),
    lastActiveAt: Date.now(),
    banned: false,
    locked: false,
    ...overrides,
  };
}
