/** @jest-environment node */
import mongoose, { type FilterQuery } from 'mongoose';
import {
  Experience,
  type IExperience,
} from '@lodgeflow/database/models/Experience';
import { NextRequest } from 'next/server';

const TypedExperience = mongoose.model<IExperience>(
  'ExperienceQueryFixture',
  Experience.schema
);
type ExperienceDocument = InstanceType<typeof TypedExperience>;
const mockConnect = jest.fn<Promise<void>, []>();
const mockSort = jest.fn<Promise<ExperienceDocument[]>, [object]>();
const mockFind = jest.fn<
  { sort: typeof mockSort },
  [FilterQuery<IExperience>]
>();
jest.mock('@lodgeflow/database', () => ({
  connectDB: () => mockConnect(),
  Experience: { find: (query: FilterQuery<IExperience>) => mockFind(query) },
}));
import { GET } from '@/app/api/experiences/route';

function experience() {
  return new TypedExperience({
    name: 'Forest walk',
    description: 'A guided woodland walk',
    price: 25,
    duration: '2 hours',
    difficulty: 'Easy',
    category: 'Nature',
    image: 'https://example.invalid/walk.jpg',
    includes: ['Guide'],
    available: ['Monday'],
    ctaText: 'Book now',
    isPopular: true,
    tags: ['forest', 'family'],
    maxParticipants: 4,
    createdAt: new Date('2030-01-01T12:00:00Z'),
    updatedAt: new Date('2030-02-01T12:00:00Z'),
    __v: 2,
  });
}
function listing(query = '') {
  return GET(new NextRequest(`http://localhost/api/experiences${query}`));
}
beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockConnect.mockResolvedValue();
  mockFind.mockReturnValue({ sort: mockSort });
  mockSort.mockResolvedValue([experience()]);
});
afterEach(() => jest.restoreAllMocks());

describe('experience query characterization', () => {
  test('preserves hydrated JSON and popular-first, price-second sorting', async () => {
    const row = experience();
    const before = JSON.stringify(row);
    mockSort.mockResolvedValue([row]);
    const response = await listing();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: [JSON.parse(before)],
    });
    expect(mockFind).toHaveBeenCalledWith({});
    expect(mockSort).toHaveBeenCalledWith({ isPopular: -1, price: 1 });
    expect(JSON.stringify(row)).toBe(before);
  });

  test('combines existing category, difficulty, positive price, false popularity and tag filters', async () => {
    const response = await listing(
      '?category=Nature&difficulty=Easy&minPrice=10&maxPrice=40&isPopular=false&tags=forest,family'
    );
    expect(response.status).toBe(200);
    expect(mockFind).toHaveBeenCalledWith({
      category: 'Nature',
      difficulty: 'Easy',
      price: { $gte: 10, $lte: 40 },
      isPopular: false,
      tags: { $in: ['forest', 'family'] },
    });
  });

  test.each([
    ['?minPrice=10', { price: { $gte: 10 } }],
    ['?maxPrice=40', { price: { $lte: 40 } }],
    ['?minPrice=40&maxPrice=10', { price: { $gte: 40, $lte: 10 } }],
  ])('retains price comparison inputs for %s', async (query, expected) => {
    expect((await listing(query)).status).toBe(200);
    expect(mockFind).toHaveBeenCalledWith(expected);
  });

  test('retains empty string omissions and existing boolean/tag parsing', async () => {
    expect((await listing('?category=&tags=&isPopular=anything')).status).toBe(
      200
    );
    expect(mockFind).toHaveBeenLastCalledWith({ isPopular: false });
    expect(
      (await listing('?tags=%20forest,family%20&isPopular=true')).status
    ).toBe(200);
    expect(mockFind).toHaveBeenLastCalledWith({
      isPopular: true,
      tags: { $in: [' forest', 'family '] },
    });
  });

  test('keeps the final repeated value and strips unknown/operator query keys', async () => {
    expect(
      (await listing('?category=Nature&category=Water&price[$ne]=0&limit=1'))
        .status
    ).toBe(200);
    expect(mockFind).toHaveBeenCalledWith({ category: 'Water' });
  });

  test.each([
    ['?minPrice=-1', 'minPrice'],
    ['?maxPrice=invalid', 'maxPrice'],
    ['?difficulty=Impossible', 'difficulty'],
  ])('rejects invalid %s before querying the catalog', async (query, field) => {
    const response = await listing(query);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      error: expect.stringContaining(`${field}:`),
    });
    expect(mockFind).not.toHaveBeenCalled();
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  test('returns an empty success envelope when the query has no matches', async () => {
    mockSort.mockResolvedValue([]);
    const response = await listing('?minPrice=100');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, data: [] });
  });

  test('keeps connection failure before invalid-query handling and returns a safe 500', async () => {
    mockConnect.mockRejectedValue(new Error('Private connection detail'));
    const response = await listing('?minPrice=-1');
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Failed to fetch experiences',
    });
    expect(mockFind).not.toHaveBeenCalled();
  });

  test('returns the safe 500 when the catalog query fails', async () => {
    mockSort.mockRejectedValue(new Error('Private query detail'));
    const response = await listing();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Failed to fetch experiences',
    });
  });
});

describe('experience zero price regression', () => {
  test.each([
    ['?minPrice=0', { price: { $gte: 0 } }],
    ['?maxPrice=0', { price: { $lte: 0 } }],
    ['?minPrice=0&maxPrice=0', { price: { $gte: 0, $lte: 0 } }],
    ['?minPrice=0&maxPrice=40', { price: { $gte: 0, $lte: 40 } }],
  ])('retains the explicit zero in %s', async (query, expected) => {
    expect((await listing(query)).status).toBe(200);
    expect(mockFind).toHaveBeenCalledWith(expected);
  });
});
