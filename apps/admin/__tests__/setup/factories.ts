import { faker } from '@faker-js/faker';
import {
  DINING_CATEGORIES,
  DINING_TYPES,
  EXPERIENCE_DIFFICULTIES,
  MEAL_TYPES,
} from '@lodgeflow/database/config';
import type {
  IBooking,
  ICabin,
  IDining,
  IExperience,
  ISettings,
} from '@lodgeflow/database';
import type { CustomerClerkSource } from '@/lib/clerk-users';
import { Types, type Document } from 'mongoose';

type ModelInput<
  Model,
  RequiredFields extends keyof Model = never,
  VirtualFields extends keyof Model = never,
> = Pick<Model, RequiredFields> &
  Partial<
    Omit<
      Model,
      | keyof Document
      | 'createdAt'
      | 'updatedAt'
      | RequiredFields
      | VirtualFields
    >
  >;

export type CabinInput = ModelInput<
  ICabin,
  'name' | 'description' | 'capacity' | 'price' | 'image',
  'discountedPrice'
>;

export type BookingInput = Omit<
  ModelInput<
    IBooking,
    | 'cabin'
    | 'customer'
    | 'checkInDate'
    | 'checkOutDate'
    | 'numNights'
    | 'numGuests'
    | 'cabinPrice'
    | 'totalPrice',
    'durationText' | 'paymentStatus'
  >,
  'extras'
> & { extras?: Partial<IBooking['extras']> };

export type DiningInput = ModelInput<
  IDining,
  | 'name'
  | 'description'
  | 'type'
  | 'mealType'
  | 'price'
  | 'servingTime'
  | 'maxPeople'
  | 'category'
  | 'image'
>;

export type ExperienceInput = ModelInput<
  IExperience,
  | 'name'
  | 'price'
  | 'duration'
  | 'difficulty'
  | 'category'
  | 'description'
  | 'image'
  | 'ctaText'
>;

type SettingsInput = ModelInput<ISettings, never, 'fullAddress'>;

// ---- Cabin Factory ----
export function createCabinInput(
  overrides: Partial<CabinInput> = {}
): CabinInput {
  return {
    name: faker.lorem.words(2) + ' Cabin',
    description: faker.lorem.sentence(10),
    capacity: faker.number.int({ min: 1, max: 10 }),
    price: faker.number.int({ min: 50, max: 500 }),
    discount: 0,
    image: `https://example.com/${faker.string.alphanumeric(10)}.jpg`,
    amenities: ['WiFi', 'Air Conditioning'],
    status: 'active',
    ...overrides,
  };
}

// ---- Booking Factory ----
export function createBookingInput(
  overrides: Partial<BookingInput> = {}
): BookingInput {
  const checkIn = faker.date.soon({ days: 182 });
  const numNights = faker.number.int({ min: 1, max: 7 });
  const checkOut = new Date(checkIn);
  checkOut.setDate(checkOut.getDate() + numNights);
  const cabinPrice = faker.number.int({ min: 100, max: 500 }) * numNights;

  return {
    cabin: new Types.ObjectId(),
    customer: `user_${faker.string.alphanumeric(10)}`,
    checkInDate: checkIn,
    checkOutDate: checkOut,
    numNights,
    numGuests: faker.number.int({ min: 1, max: 4 }),
    status: 'unconfirmed',
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
    payments:
      overrides.isPaid || overrides.depositPaid
        ? [
            {
              id: 'test-receipt',
              method: 'cash',
              receivedAt: new Date(),
              amount: overrides.isPaid
                ? (overrides.totalPrice ?? cabinPrice)
                : (overrides.depositAmount ?? 0),
            },
          ]
        : [],
    ...overrides,
  };
}

// ---- Dining Factory ----
export function createDiningInput(
  overrides: Partial<DiningInput> = {}
): DiningInput {
  return {
    name: faker.lorem.words(3),
    description: faker.lorem.sentence(10),
    price: faker.number.float({ min: 5, max: 50, fractionDigits: 2 }),
    type: faker.helpers.arrayElement(DINING_TYPES),
    mealType: faker.helpers.arrayElement(MEAL_TYPES),
    category: faker.helpers.arrayElement(DINING_CATEGORIES),
    servingTime: { start: '07:00', end: '21:00' },
    maxPeople: faker.number.int({ min: 2, max: 20 }),
    image: `https://example.com/${faker.string.alphanumeric(10)}.jpg`,
    isAvailable: true,
    ...overrides,
  };
}

// ---- Experience Factory ----
export function createExperienceInput(
  overrides: Partial<ExperienceInput> = {}
): ExperienceInput {
  return {
    name: faker.lorem.words(3),
    description: faker.lorem.sentence(10),
    price: faker.number.int({ min: 20, max: 200 }),
    duration: `${faker.number.int({ min: 1, max: 8 })} hours`,
    difficulty: faker.helpers.arrayElement(EXPERIENCE_DIFFICULTIES),
    maxParticipants: faker.number.int({ min: 2, max: 20 }),
    category: faker.lorem.word(),
    image: `https://example.com/${faker.string.alphanumeric(10)}.jpg`,
    available: ['Monday', 'Wednesday', 'Saturday'],
    ctaText: 'Book Now',
    ...overrides,
  };
}

// ---- Settings Factory ----
export function createSettingsInput(
  overrides: Partial<SettingsInput> = {}
): SettingsInput {
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
export function createMockClerkUser(
  overrides: Partial<CustomerClerkSource> = {}
): CustomerClerkSource {
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
