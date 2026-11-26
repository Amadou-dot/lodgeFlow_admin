import {
  catalogDeleteResponseSchema,
  diningListResponseSchema,
  diningResponseSchema,
} from '@/lib/validations/catalog-json';
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { Dining, connectDB } from '@lodgeflow/database';
import { GET, POST, PUT } from '@/app/api/dining/route';
import {
  DELETE,
  GET as getById,
  PUT as updateById,
} from '@/app/api/dining/[id]/route';
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
  const listBody: unknown = await list.json();
  expect(listBody).toEqual({ success: true, data: [expected] });
  expect(diningListResponseSchema.parse(listBody)).toEqual([expected]);
  const detail = await getById(request(), params(String(item._id)));
  expect(detail.status).toBe(200);
  const detailBody: unknown = await detail.json();
  expect(detailBody).toEqual({ success: true, data: expected });
  expect(diningResponseSchema.parse(detailBody)).toEqual(expected);
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
    price: 12.345,
    servingTime: { start: 'Evening', end: 'Late' },
    maxPeople: 4.5,
    image: payload.image,
    location: null,
    updatedAt: new Date('+010000-01-01T00:00:00.000Z'),
    __v: null,
    tags: ['', null, 'Local'],
    rating: null,
    gallery: null,
    isAvailable: null,
    dietary: [null, 'vegan'],
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
  const detailBody: unknown = await response.json();
  expect(detailBody).toEqual({ success: true, data: expected });
  expect(diningResponseSchema.parse(detailBody)).toEqual(expected);
  expect(expected).toMatchObject({
    location: null,
    updatedAt: '+010000-01-01T00:00:00.000Z',
    __v: null,
    price: 12.345,
    tags: ['', null, 'Local'],
    rating: null,
    gallery: null,
    dietary: [null, 'vegan'],
    maxPeople: 4.5,
    minPeople: 1,
    isAvailable: null,
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
  const body: unknown = await response.json();
  expect(body).toEqual({
    success: true,
    data: json(stored),
    message: 'Dining item created successfully',
  });
  expect(diningResponseSchema.parse(body)).toEqual(json(stored));
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
    const body: unknown = await response.json();
    expect(body).toEqual({
      success: true,
      data: json(stored),
      message: 'Dining item updated successfully',
    });
    expect(diningResponseSchema.parse(body)).toEqual(json(stored));
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

test('deletion returns an explicit null success envelope', async () => {
  const item = await Dining.create(payload);
  const id = String(item._id);
  const response = await DELETE(request({ method: 'DELETE' }), params(id));
  expect(response.status).toBe(200);
  const body: unknown = await response.json();
  expect(catalogDeleteResponseSchema.parse(body)).toEqual({
    success: true,
    data: null,
    message: 'Dining item deleted successfully',
  });
  expect(await Dining.findById(id)).toBeNull();
});

test('omits an unavailable legacy flag on rename and persists an explicit availability choice', async () => {
  const item = await Dining.create(payload);
  const id = String(item._id);
  await Dining.collection.updateOne(
    { _id: item._id },
    { $set: { isAvailable: null } }
  );

  const renamed = await updateById(
    request({ method: 'PUT', body: { _id: id, name: 'Renamed' } }),
    params(id)
  );
  expect(renamed.status).toBe(200);
  expect(
    diningResponseSchema.parse(await renamed.json()).isAvailable
  ).toBeNull();
  expect(await Dining.findOne({ _id: id, isAvailable: true })).toBeNull();

  const madeAvailable = await updateById(
    request({ method: 'PUT', body: { _id: id, isAvailable: true } }),
    params(id)
  );
  expect(madeAvailable.status).toBe(200);
  expect(
    diningResponseSchema.parse(await madeAvailable.json()).isAvailable
  ).toBe(true);
  expect(await Dining.findOne({ _id: id, isAvailable: true })).toMatchObject({
    name: 'Renamed',
    isAvailable: true,
  });
});
