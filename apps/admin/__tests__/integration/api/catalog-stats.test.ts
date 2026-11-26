import { GET as cabins } from '@/app/api/cabins/stats/route';
import { GET as dining } from '@/app/api/dining/stats/route';
import { GET as experiences } from '@/app/api/experiences/stats/route';
import { GET as bookings } from '@/app/api/bookings/stats/route';
import { Cabin, Dining, Experience, Booking } from '@lodgeflow/database';
import { createErrorResponse, requireApiAuth } from '@/lib/api-utils';
import connectDB from '@/lib/mongodb';
import { logger } from '@/lib/logger';
import {
  bookingStatsJsonSchema,
  cabinStatsJsonSchema,
  diningStatsJsonSchema,
  experienceStatsJsonSchema,
  parseReportJson,
} from '@/lib/validations/reporting-json';
import type { z } from 'zod';
jest.mock('@/lib/mongodb', () => jest.fn().mockResolvedValue(undefined));
const catalogRoutes = [
  { route: cabins, schema: cabinStatsJsonSchema },
  { route: dining, schema: diningStatsJsonSchema },
  { route: experiences, schema: experienceStatsJsonSchema },
];
const statsRoutes = [
  ...catalogRoutes,
  { route: bookings, schema: bookingStatsJsonSchema },
];
const routes = statsRoutes.map(({ route }) => route);

async function readStats({ route, schema }: (typeof statsRoutes)[number]) {
  const response = await route();
  expect(response.status).toBe(200);
  const value: unknown = await response.json();

  return parseReportJson<z.output<typeof schema>>({
    value,
    schema,
    format: 'wrapped',
    errorMessage: 'Unexpected stats response',
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(requireApiAuth).mockResolvedValue({
    authenticated: true,
    userId: 'staff',
    role: 'front_desk',
  });
});
afterEach(() => jest.restoreAllMocks());
test.each(statsRoutes)(
  'empty stats retain zero defaults and success envelope',
  async entry => {
    const data = await readStats(entry);
    expect(Object.values(data).every(value => value === 0)).toBe(true);
    expect(data).not.toHaveProperty('_id');
  }
);
test.each(routes)('stats deny before database access', async route => {
  jest.mocked(requireApiAuth).mockResolvedValueOnce({
    authenticated: false,
    error: createErrorResponse('Denied', 403),
  });
  expect((await route()).status).toBe(403);
  expect(connectDB).not.toHaveBeenCalled();
});
test.each(routes)(
  'unexpected stats failures are safely logged',
  async route => {
    const error = new Error('private detail');
    jest.mocked(connectDB).mockRejectedValueOnce(error);
    const log = jest.spyOn(logger, 'error');
    const response = await route();
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('private');
    expect(log).toHaveBeenCalledWith(expect.any(String), error);
  }
);
test('real catalog aggregates preserve rounded prices, capacities and native status counts', async () => {
  for (const [status, price] of [
    ['active', 10],
    ['inactive', 15],
    ['maintenance', 20],
  ] as const)
    await Cabin.create({
      name: status,
      description: 'Cabin',
      image: 'https://example.invalid/c.jpg',
      capacity: 4,
      price,
      discount: status === 'active' ? 1 : 0,
      status,
    });
  await Dining.create({
    name: 'Dinner',
    description: 'Dinner',
    image: 'https://example.invalid/d.jpg',
    price: 12.5,
    type: 'menu',
    mealType: 'dinner',
    category: 'regular',
    maxPeople: 4,
    servingTime: { start: '17:00', end: '22:00' },
  });
  await Experience.create({
    name: 'Hike',
    description: 'Hike',
    image: 'https://example.invalid/e.jpg',
    price: 12.5,
    duration: '2h',
    category: 'Outdoor',
    difficulty: 'Easy',
    includes: ['Guide'],
    available: ['Monday'],
    ctaText: 'Book',
    maxParticipants: 4,
    isPopular: true,
  });
  expect(
    await readStats({ route: cabins, schema: cabinStatsJsonSchema })
  ).toEqual({
    totalCabins: 3,
    totalCapacity: 12,
    averagePrice: 15,
    cabinsWithDiscount: 1,
    activeCabins: 1,
    inactiveCabins: 1,
    maintenanceCabins: 1,
  });
  expect(
    await readStats({ route: dining, schema: diningStatsJsonSchema })
  ).toEqual({
    totalItems: 1,
    menuCount: 1,
    experienceCount: 0,
    averagePrice: 12,
    availableItems: 1,
  });
  expect(
    await readStats({ route: experiences, schema: experienceStatsJsonSchema })
  ).toEqual({
    totalExperiences: 1,
    totalCapacity: 4,
    averagePrice: 12,
    popularCount: 1,
  });
  expect(await Booking.countDocuments()).toBe(0);
});

test('catalog aggregates retain null prices when legacy documents have no numeric price', async () => {
  await Cabin.collection.insertOne({ capacity: 0, status: 'active' });
  await Dining.collection.insertOne({ price: null, type: 'menu' });
  await Experience.collection.insertOne({ price: null });

  for (const entry of catalogRoutes) {
    const data = await readStats(entry);
    expect(data).toMatchObject({ averagePrice: null });
  }
});
