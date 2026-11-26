import {
  catalogDeleteResponseSchema,
  experienceListResponseSchema,
  experienceResponseSchema,
} from '@/lib/validations/catalog-json';
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { Experience } from '@lodgeflow/database';
import { GET, POST } from '@/app/api/experiences/route';
import { DELETE, GET as getById, PUT } from '@/app/api/experiences/[id]/route';
import { createErrorResponse, requireApiAuth } from '@/lib/api-utils';
import connectDB from '@/lib/mongodb';

jest.mock('@/lib/mongodb', () => jest.fn().mockResolvedValue(undefined));
const payload = {
  name: 'Forest walk',
  price: 25,
  duration: '2 hours',
  difficulty: 'Easy',
  category: 'Nature',
  description: 'Explore the forest with a local guide',
  longDescription: 'A longer description of the forest walk',
  image: 'https://example.invalid/walk.jpg',
  gallery: ['https://example.invalid/tree.jpg'],
  includes: ['Guide'],
  available: ['Monday'],
  ctaText: 'Book now',
  isPopular: true,
  maxParticipants: 4,
  minAge: 8,
  requirements: ['Walking shoes'],
  location: 'Forest',
  highlights: ['River'],
  whatToBring: ['Water'],
  cancellationPolicy: 'Flexible',
  seasonality: 'Summer',
  tags: ['Outdoors'],
  rating: 4.5,
  reviewCount: 3,
} as const;
function request({
  method = 'GET',
  body,
}: { method?: string; body?: unknown } = {}) {
  return new NextRequest('https://admin.test/api/experiences', {
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

test('list/detail return full saved JSON with IDs, timestamps and version', async () => {
  const item = await Experience.create(payload);
  const expected = json(await Experience.findById(item._id));
  const list = await GET(request());
  expect(list.status).toBe(200);
  const listBody: unknown = await list.json();
  expect(listBody).toEqual({ success: true, data: [expected] });
  expect(experienceListResponseSchema.parse(listBody)).toEqual([expected]);
  const detail = await getById(request(), params(String(item._id)));
  expect(detail.status).toBe(200);
  const detailBody: unknown = await detail.json();
  expect(detailBody).toEqual({ success: true, data: expected });
  expect(experienceResponseSchema.parse(detailBody)).toEqual(expected);
  expect(expected).not.toHaveProperty('reservationVersion');
});

test('retains hydrated defaults, sparse omissions and explicit legacy nulls', async () => {
  const id = new Types.ObjectId();
  await Experience.collection.insertOne({
    _id: id,
    name: payload.name,
    price: 12.345,
    duration: payload.duration,
    difficulty: 'Easy',
    category: 'Nature',
    description: payload.description,
    image: payload.image,
    ctaText: 'Book now',
    gallery: null,
    rating: null,
    location: null,
    updatedAt: new Date('+010000-01-01T00:00:00.000Z'),
    __v: null,
    tags: ['', null, 'Local'],
    minAge: null,
    available: null,
  });
  const expected = json(await Experience.findById(id));
  const response = await getById(request(), params(String(id)));
  expect(response.status).toBe(200);
  const detailBody: unknown = await response.json();
  expect(detailBody).toEqual({ success: true, data: expected });
  expect(experienceResponseSchema.parse(detailBody)).toEqual(expected);
  expect(expected).toMatchObject({
    gallery: null,
    rating: null,
    location: null,
    minAge: null,
    updatedAt: '+010000-01-01T00:00:00.000Z',
    __v: null,
    price: 12.345,
    tags: ['', null, 'Local'],
    isPopular: false,
    includes: [],
    available: null,
  });
  expect(expected).not.toHaveProperty('createdAt');
});

test('creation retains selected reservationVersion and defaults', async () => {
  const response = await POST(request({ method: 'POST', body: payload }));
  expect(response.status).toBe(201);
  const stored = await Experience.findOne({ name: payload.name }).select(
    '+reservationVersion'
  );
  const body: unknown = await response.json();
  expect(body).toEqual({ success: true, data: json(stored) });
  expect(experienceResponseSchema.parse(body)).toEqual(json(stored));
});

test('update preserves omitted fields and exact saved JSON', async () => {
  const item = await Experience.create(payload);
  const id = String(item._id);
  const response = await PUT(
    request({ method: 'PUT', body: { name: 'Renamed' } }),
    params(id)
  );
  expect(response.status).toBe(200);
  const stored = await Experience.findById(id);
  expect(stored).toMatchObject({
    name: 'Renamed',
    price: 25,
    maxParticipants: 4,
  });
  const body: unknown = await response.json();
  expect(body).toEqual({ success: true, data: json(stored) });
  expect(experienceResponseSchema.parse(body)).toEqual(json(stored));
});

test.each(['list', 'detail'])(
  '%s denies before database access',
  async route => {
    const error = createErrorResponse('Denied', 403);
    jest
      .mocked(requireApiAuth)
      .mockResolvedValue({ authenticated: false, error });
    expect(
      route === 'list'
        ? await GET(request())
        : await getById(request(), params('bad'))
    ).toBe(error);
    expect(connectDB).not.toHaveBeenCalled();
    expect(requireApiAuth).toHaveBeenCalledWith({
      permission: 'bookings:read',
    });
  }
);

test('deletion returns an explicit null success envelope', async () => {
  const item = await Experience.create(payload);
  const id = String(item._id);
  const response = await DELETE(request({ method: 'DELETE' }), params(id));
  expect(response.status).toBe(200);
  const body: unknown = await response.json();
  expect(catalogDeleteResponseSchema.parse(body)).toEqual({
    success: true,
    data: null,
    message: 'Experience deleted successfully',
  });
  expect(await Experience.findById(id)).toBeNull();
});
