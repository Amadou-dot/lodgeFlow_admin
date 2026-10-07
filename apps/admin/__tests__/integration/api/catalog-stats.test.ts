import { GET as cabins } from '@/app/api/cabins/stats/route';
import { GET as dining } from '@/app/api/dining/stats/route';
import { GET as experiences } from '@/app/api/experiences/stats/route';
import { GET as bookings } from '@/app/api/bookings/stats/route';
import { Cabin, Dining, Experience, Booking } from '@lodgeflow/database';
import { createErrorResponse, requireApiAuth } from '@/lib/api-utils';
import connectDB from '@/lib/mongodb';
import { logger } from '@/lib/logger';
jest.mock('@/lib/mongodb', () => jest.fn().mockResolvedValue(undefined));
const routes = [cabins, dining, experiences, bookings];
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(requireApiAuth).mockResolvedValue({
    authenticated: true,
    userId: 'staff',
    role: 'front_desk',
  });
});
afterEach(() => jest.restoreAllMocks());
test.each(routes)(
  'empty stats retain zero defaults and success envelope',
  async route => {
    const response = await route();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Object.values(body.data).every(value => value === 0)).toBe(true);
    expect(body.data).not.toHaveProperty('_id');
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
  expect((await (await cabins()).json()).data).toEqual({
    totalCabins: 3,
    totalCapacity: 12,
    averagePrice: 15,
    cabinsWithDiscount: 1,
    activeCabins: 1,
    inactiveCabins: 1,
    maintenanceCabins: 1,
  });
  expect((await (await dining()).json()).data).toEqual({
    totalItems: 1,
    menuCount: 1,
    experienceCount: 0,
    averagePrice: 12,
    availableItems: 1,
  });
  expect((await (await experiences()).json()).data).toEqual({
    totalExperiences: 1,
    totalCapacity: 4,
    averagePrice: 12,
    popularCount: 1,
  });
  expect(await Booking.countDocuments()).toBe(0);
});
