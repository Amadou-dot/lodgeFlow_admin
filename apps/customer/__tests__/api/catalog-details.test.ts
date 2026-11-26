/** @jest-environment node */
import { Types } from 'mongoose';
import type { DiningJsonSource } from '@lodgeflow/database/dining-json';
import type { ExperienceJsonSource } from '@lodgeflow/database/experience-json';
import {
  readCatalogResponse,
  diningDetailSchema,
  experienceDetailSchema,
} from '@/lib/validations/catalog-json';
import { NextRequest } from 'next/server';
import { logger } from '@lodgeflow/database/logger';
const mockConnect = jest.fn();
const mockLean = jest.fn<
  Promise<DiningJsonSource | ExperienceJsonSource | null>,
  []
>();
const mockFind = jest.fn(() => ({ lean: mockLean }));
jest.mock('@lodgeflow/database', () => ({
  connectDB: () => mockConnect(),
  Dining: { findById: () => mockFind() },
  Experience: { findById: () => mockFind() },
}));
import { GET as dining } from '@/app/api/dining/[id]/route';
import { GET as experience } from '@/app/api/experiences/[id]/route';
beforeEach(() => {
  jest.clearAllMocks();
  mockLean.mockResolvedValue(null);
  mockConnect.mockResolvedValue(undefined);
});
afterEach(() => jest.restoreAllMocks());
for (const route of [dining, experience]) {
  test('missing catalogs retain their 404 envelope', async () => {
    const response = await route(new NextRequest('https://customer.test'), {
      params: Promise.resolve({ id: '507f1f77bcf86cd799439011' }),
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      success: false,
      error:
        route === dining ? 'Dining item not found' : 'Experience not found',
    });
  });
  test('invalid catalog IDs fail before connection', async () => {
    const response = await route(new NextRequest('https://customer.test'), {
      params: Promise.resolve({ id: 'invalid' }),
    });
    expect(response.status).toBe(404);
    expect(mockConnect).not.toHaveBeenCalled();
    expect(mockFind).not.toHaveBeenCalled();
  });
  test('unexpected database failures are safely logged', async () => {
    const failure = new Error('private database detail');
    const log = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockConnect.mockRejectedValueOnce(failure);
    const response = await route(new NextRequest('https://customer.test'), {
      params: Promise.resolve({ id: '507f1f77bcf86cd799439011' }),
    });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Internal server error',
    });
    expect(log).toHaveBeenCalledWith(expect.any(String), failure);
  });
}

const objectId = new Types.ObjectId('507f1f77bcf86cd7994390ab');
const id = objectId.toHexString();
const request = () => new NextRequest('https://customer.test');
const params = () => ({ params: Promise.resolve({ id: id.toUpperCase() }) });

test('the dining reader accepts lean route JSON with a beverage without a stored ID and absent defaults', async () => {
  const row = {
    _id: objectId,
    name: 'Soup',
    description: 'Local vegetables',
    type: 'menu',
    mealType: 'lunch',
    category: 'regular',
    price: 12.345,
    maxPeople: 4.5,
    servingTime: { start: 'Noon', end: 'Late' },
    image: '/soup',
    gallery: null,
    beverages: [{ name: 'Juice', category: 'non-alcoholic', price: null }],
    updatedAt: null,
  } satisfies DiningJsonSource;
  mockLean.mockResolvedValue(row);
  const response = await dining(request(), params());
  expect(response.status).toBe(200);
  const expected = { ...row, _id: id };
  expect(await response.clone().json()).toStrictEqual({
    success: true,
    data: expected,
  });
  expect(
    await readCatalogResponse({
      response,
      schema: diningDetailSchema(id.toUpperCase()),
      fallback: 'Unexpected catalog response',
    })
  ).toStrictEqual(expected);
});
test('the experience reader accepts lean route JSON with sparse defaults and explicit null arrays', async () => {
  const row = {
    _id: objectId,
    name: 'Tour',
    description: 'Guided walk',
    duration: '2h',
    difficulty: 'Easy',
    category: 'Nature',
    image: '/tour',
    ctaText: 'Reserve',
    price: 0,
    available: null,
    includes: null,
    gallery: [null, '', '/trail'],
    createdAt: new Date('+010000-01-01T00:00:00.000Z'),
  } satisfies ExperienceJsonSource;
  mockLean.mockResolvedValue(row);
  const response = await experience(request(), params());
  expect(response.status).toBe(200);
  const expected = { ...row, _id: id, createdAt: row.createdAt.toISOString() };
  expect(await response.clone().json()).toStrictEqual({
    success: true,
    data: expected,
  });
  expect(
    await readCatalogResponse({
      response,
      schema: experienceDetailSchema(id.toUpperCase()),
      fallback: 'Unexpected catalog response',
    })
  ).toStrictEqual(expected);
});
