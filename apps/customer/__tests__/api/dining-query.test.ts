/** @jest-environment node */
import mongoose, { type FilterQuery } from 'mongoose';
import Dining, { type IDining } from '@lodgeflow/database/models/Dining';

const TypedDining = mongoose.model<IDining>(
  'DiningQueryFixture',
  Dining.schema
);
type DiningDocument = InstanceType<typeof TypedDining>;
const mockConnect = jest.fn<Promise<void>, []>();
const mockSort = jest.fn<Promise<DiningDocument[]>, [object]>();
const mockFind = jest.fn<{ sort: typeof mockSort }, [FilterQuery<IDining>]>();
jest.mock('@lodgeflow/database', () => ({
  connectDB: () => mockConnect(),
  Dining: { find: (query: FilterQuery<IDining>) => mockFind(query) },
}));
import { GET } from '@/app/api/dining/route';

function dining() {
  return new TypedDining({
    name: 'Forest dinner',
    description: 'A seasonal vegetarian menu',
    price: 25,
    type: 'menu',
    mealType: 'dinner',
    category: 'regular',
    servingTime: { start: '17:00', end: '22:00' },
    minPeople: 1,
    maxPeople: 4,
    image: 'https://example.invalid/dinner.jpg',
    dietary: ['vegetarian'],
    isAvailable: true,
    isPopular: true,
    createdAt: new Date('2030-01-01T12:00:00Z'),
    updatedAt: new Date('2030-02-01T12:00:00Z'),
    __v: 2,
  });
}
function listing(query = '') {
  return GET(new Request(`http://localhost/api/dining${query}`));
}
beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockConnect.mockResolvedValue();
  mockFind.mockReturnValue({ sort: mockSort });
  mockSort.mockResolvedValue([dining()]);
});
afterEach(() => jest.restoreAllMocks());

describe('dining query characterization', () => {
  test('preserves available-only hydrated JSON and meal/type/name sorting', async () => {
    const row = dining();
    const before = JSON.stringify(row);
    mockSort.mockResolvedValue([row]);
    const response = await listing();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: [JSON.parse(before)],
    });
    expect(mockFind).toHaveBeenCalledWith({ isAvailable: true });
    expect(mockSort).toHaveBeenCalledWith({ mealType: 1, type: 1, name: 1 });
    expect(JSON.stringify(row)).toBe(before);
  });

  test('combines existing catalog, positive price, false popularity, dietary and search filters', async () => {
    const response = await listing(
      '?type=menu&mealType=dinner&category=regular&minPrice=10&maxPrice=40&isPopular=false&dietary=vegan,vegetarian&search=Forest%7Cvegan'
    );
    expect(response.status).toBe(200);
    expect(mockFind).toHaveBeenCalledWith({
      isAvailable: true,
      type: 'menu',
      mealType: 'dinner',
      category: 'regular',
      price: { $gte: 10, $lte: 40 },
      isPopular: false,
      dietary: { $in: ['vegan', 'vegetarian'] },
      $or: [
        { name: { $regex: 'Forest|vegan', $options: 'i' } },
        { description: { $regex: 'Forest|vegan', $options: 'i' } },
        { dietary: { $regex: 'Forest|vegan', $options: 'i' } },
      ],
    });
  });

  test.each([
    ['?minPrice=10', { price: { $gte: 10 } }],
    ['?maxPrice=40', { price: { $lte: 40 } }],
    ['?minPrice=40&maxPrice=10', { price: { $gte: 40, $lte: 10 } }],
  ])('retains price comparisons for %s', async (query, expected) => {
    expect((await listing(query)).status).toBe(200);
    expect(mockFind).toHaveBeenCalledWith({ isAvailable: true, ...expected });
  });

  test('retains empty omissions and existing boolean/CSV parsing', async () => {
    expect(
      (await listing('?category=&dietary=&search=&isPopular=anything')).status
    ).toBe(200);
    expect(mockFind).toHaveBeenLastCalledWith({
      isAvailable: true,
      isPopular: false,
    });
    expect(
      (await listing('?dietary=%20vegan,vegetarian%20&isPopular=true')).status
    ).toBe(200);
    expect(mockFind).toHaveBeenLastCalledWith({
      isAvailable: true,
      isPopular: true,
      dietary: { $in: [' vegan', 'vegetarian '] },
    });
  });

  test('keeps the final repeated value and cannot override availability with unknown/operator keys', async () => {
    expect(
      (
        await listing(
          '?category=regular&category=unknown&isAvailable=false&isAvailable[$ne]=true&limit=1'
        )
      ).status
    ).toBe(200);
    expect(mockFind).toHaveBeenCalledWith({
      isAvailable: true,
      category: 'unknown',
    });
  });

  test.each([
    ['?minPrice=-1', 'minPrice'],
    ['?maxPrice=invalid', 'maxPrice'],
    ['?mealType=midnight', 'mealType'],
    ['?type=drink', 'type'],
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

  test('keeps connection failure before invalid-query handling and preserves the message envelope', async () => {
    mockConnect.mockRejectedValue(new Error('Private connection detail'));
    const response = await listing('?minPrice=-1');
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      message: 'Failed to fetch dining options',
    });
    expect(mockFind).not.toHaveBeenCalled();
  });

  test('preserves the safe message envelope when the catalog query fails', async () => {
    mockSort.mockRejectedValue(new Error('Private query detail'));
    const response = await listing();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      message: 'Failed to fetch dining options',
    });
  });
});

describe('dining zero price regression', () => {
  test.each([
    ['?minPrice=0', { price: { $gte: 0 } }],
    ['?maxPrice=0', { price: { $lte: 0 } }],
    ['?minPrice=0&maxPrice=0', { price: { $gte: 0, $lte: 0 } }],
    ['?minPrice=0&maxPrice=40', { price: { $gte: 0, $lte: 40 } }],
  ])('retains the explicit zero in %s', async (query, expected) => {
    expect((await listing(query)).status).toBe(200);
    expect(mockFind).toHaveBeenCalledWith({ isAvailable: true, ...expected });
  });
});
