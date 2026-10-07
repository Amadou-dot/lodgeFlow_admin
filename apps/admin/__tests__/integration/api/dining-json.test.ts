import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { Dining, connectDB } from '@lodgeflow/database';
import { GET, POST, PUT } from '@/app/api/dining/route';
import { GET as getById, PUT as updateById } from '@/app/api/dining/[id]/route';
import { createErrorResponse, requireApiAuth } from '@/lib/api-utils';

jest.mock('@lodgeflow/database/mongodb', () =>
  jest.fn().mockResolvedValue(undefined)
);

const payload = {
  name: 'Forest dinner',
  description: 'A seasonal vegetarian menu in the forest',
  price: 25,
  type: 'menu',
  mealType: 'dinner',
  category: 'regular',
  servingTime: { start: '17:00', end: '22:00' },
  minPeople: 1,
  maxPeople: 4,
  image: 'https://example.invalid/dinner.jpg',
  gallery: ['https://example.invalid/dessert.jpg'],
  ingredients: ['Mushrooms'],
  allergens: ['Milk'],
  dietary: ['vegetarian'],
  beverages: [{ name: 'Juice', category: 'non-alcoholic', price: 5 }],
  includes: ['Dessert'],
  duration: '2 hours',
  location: 'Terrace',
  specialRequirements: ['Advance reservation'],
  isAvailable: true,
  isPopular: true,
  seasonality: 'Summer',
  tags: ['Local'],
  rating: 4.5,
  reviewCount: 3,
} as const;
function request({
  method = 'GET',
  body,
}: { method?: string; body?: unknown } = {}) {
  return new NextRequest('https://admin.test/api/dining', {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });
function json(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(requireApiAuth).mockResolvedValue({
    authenticated: true,
    userId: 'user_manager',
    role: 'manager',
  });
});
afterEach(() => jest.restoreAllMocks());

test('list and detail retain full saved JSON including beverage IDs, timestamps and version', async () => {
  const item = await Dining.create(payload);
  const expected = json(await Dining.findById(item._id));
  const list = await GET(request());
  expect(list.status).toBe(200);
  expect(await list.json()).toEqual({ success: true, data: [expected] });
  const detail = await getById(request(), params(String(item._id)));
  expect(detail.status).toBe(200);
  expect(await detail.json()).toEqual({ success: true, data: expected });
  expect(expected).not.toHaveProperty('reservationVersion');
});

test('retains sparse hydrated defaults, explicit legacy nulls and absent timestamps', async () => {
  const id = new Types.ObjectId();
  await Dining.collection.insertOne({
    _id: id,
    name: 'Sparse',
    description: payload.description,
    type: 'menu',
    mealType: 'dinner',
    category: 'regular',
    price: 0,
    servingTime: payload.servingTime,
    maxPeople: 4,
    image: payload.image,
    location: null,
    rating: null,
    gallery: null,
    beverages: [
      {
        _id: new Types.ObjectId(),
        name: 'Juice',
        category: 'non-alcoholic',
        price: null,
      },
    ],
  });
  const expected = json(await Dining.findById(id));
  const response = await getById(request(), params(String(id)));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ success: true, data: expected });
  expect(expected).toMatchObject({
    location: null,
    rating: null,
    gallery: null,
    minPeople: 1,
    isAvailable: true,
  });
  expect(expected).not.toHaveProperty('createdAt');
  expect(expected).not.toHaveProperty('id');
});

test('creation returns all saved JSON including its selected reservation version', async () => {
  const response = await POST(request({ method: 'POST', body: payload }));
  expect(response.status).toBe(201);
  const stored = await Dining.findOne({ name: payload.name }).select(
    '+reservationVersion'
  );
  expect(await response.json()).toEqual({
    success: true,
    data: json(stored),
    message: 'Dining item created successfully',
  });
});

test.each(['collection', 'detail'])(
  '%s update preserves omitted fields and JSON',
  async route => {
    const item = await Dining.create(payload);
    const id = String(item._id);
    const input = request({
      method: 'PUT',
      body: { _id: id, name: 'Renamed' },
    });
    const response =
      route === 'collection'
        ? await PUT(input)
        : await updateById(input, params(id));
    expect(response.status).toBe(200);
    const stored = await Dining.findById(id);
    expect(stored).toMatchObject({
      name: 'Renamed',
      isAvailable: true,
      price: 25,
    });
    expect(await response.json()).toEqual({
      success: true,
      data: json(stored),
      message: 'Dining item updated successfully',
    });
  }
);

test.each(['list', 'detail'])(
  '%s denial precedes database access',
  async route => {
    const error = createErrorResponse('Denied', 403);
    jest
      .mocked(requireApiAuth)
      .mockResolvedValue({ authenticated: false, error });
    const response =
      route === 'list'
        ? await GET(request())
        : await getById(request(), params('bad'));
    expect(response).toBe(error);
    expect(requireApiAuth).toHaveBeenCalledWith({
      permission: 'bookings:read',
    });
    expect(connectDB).not.toHaveBeenCalled();
  }
);
