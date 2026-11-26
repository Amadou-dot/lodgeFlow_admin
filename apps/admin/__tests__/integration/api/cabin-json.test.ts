import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { AuditLog, Cabin } from '@lodgeflow/database';
import { GET, POST, PUT } from '@/app/api/cabins/route';
import {
  DELETE as deleteById,
  GET as getById,
  PUT as updateById,
} from '@/app/api/cabins/[id]/route';
import { createErrorResponse, requireApiAuth } from '@/lib/api-utils';
import connectDB from '@/lib/mongodb';
import {
  cabinDeleteResponseSchema,
  cabinListResponseSchema,
  cabinResponseSchema,
} from '@/lib/validations/cabin-json';

jest.mock('@/lib/mongodb', () => jest.fn().mockResolvedValue(undefined));

const payload = {
  name: 'Birch',
  image: 'https://example.invalid/birch.jpg',
  images: ['https://example.invalid/room.jpg'],
  capacity: 4,
  price: 250,
  discount: 25,
  description: 'A peaceful cabin in the forest.',
  amenities: ['WiFi', 'Kitchen'],
  status: 'maintenance',
  bedrooms: 2,
  bathrooms: 1,
  size: 750,
  minNights: 2,
  extraGuestFee: 15,
} as const;
function request({
  path = '/api/cabins',
  method = 'GET',
  body,
}: { path?: string; method?: string; body?: unknown } = {}) {
  return new NextRequest(`https://admin.test${path}`, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
function params(id: string) {
  return { params: Promise.resolve({ id }) };
}
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
afterEach(() => {
  jest.restoreAllMocks();
});

const readers = [
  {
    name: 'list',
    invoke: (id: string) => GET(request({ path: `/api/cabins?search=${id}` })),
  },
  {
    name: 'detail',
    invoke: (id: string) =>
      getById(request({ path: `/api/cabins/${id}` }), params(id)),
  },
];
test.each(readers)(
  '$name denies before database access',
  async ({ invoke }) => {
    const error = createErrorResponse('Denied', 403);
    jest
      .mocked(requireApiAuth)
      .mockResolvedValue({ authenticated: false, error });
    expect(await invoke('bad')).toBe(error);
    expect(requireApiAuth).toHaveBeenCalledWith({
      permission: 'bookings:read',
    });
    expect(connectDB).not.toHaveBeenCalled();
  }
);

test('list and detail preserve every persisted field, virtual, ID and timestamp', async () => {
  const cabin = await Cabin.create(payload);
  const expected = json(await Cabin.findById(cabin._id));
  const list = await GET(request());
  expect(list.status).toBe(200);
  const listBody: unknown = await list.json();
  expect(listBody).toEqual({ success: true, data: [expected] });
  expect(cabinListResponseSchema.parse(listBody)).toEqual([expected]);
  const detail = await getById(request(), params(String(cabin._id)));
  expect(detail.status).toBe(200);
  const detailBody: unknown = await detail.json();
  expect(detailBody).toEqual({ success: true, data: expected });
  expect(cabinResponseSchema.parse(detailBody)).toEqual(expected);
});

test('retains hydrated defaults, nullable optional fields and absent timestamps on sparse legacy cabins', async () => {
  const id = new Types.ObjectId();
  await Cabin.collection.insertOne({
    _id: id,
    name: 'Sparse',
    image: payload.image,
    description: payload.description,
    capacity: 2,
    price: 100,
    bedrooms: null,
    bathrooms: null,
    size: null,
    minNights: null,
  });
  const expected = json(await Cabin.findById(id));
  const response = await getById(request(), params(String(id)));
  expect(response.status).toBe(200);
  const body: unknown = await response.json();
  expect(body).toEqual({ success: true, data: expected });
  expect(cabinResponseSchema.parse(body)).toEqual(expected);
  expect(expected).toMatchObject({
    _id: String(id),
    id: String(id),
    images: [],
    amenities: [],
    discount: 0,
    discountedPrice: 100,
    extraGuestFee: 0,
    status: 'active',
    bedrooms: null,
    bathrooms: null,
    size: null,
    minNights: null,
  });
  expect(expected).not.toHaveProperty('createdAt');
  expect(expected).not.toHaveProperty('updatedAt');
  expect(expected).not.toHaveProperty('__v');
});

test('list and detail keep model-valid nulls, blank amenity members and fractional fields', async () => {
  const legacy = await Cabin.create({
    ...payload,
    images: null,
    status: null,
    discount: null,
    extraGuestFee: null,
    amenities: ['WiFi', null, ''],
    capacity: 3.5,
    price: 250.125,
    minNights: 1.5,
  });
  const updatedAt = new Date('+010000-01-01T00:00:00.000Z');
  await Cabin.collection.updateOne(
    { _id: legacy._id },
    { $set: { createdAt: null, updatedAt, __v: null } }
  );
  const id = String(legacy._id);
  const expected = {
    ...payload,
    _id: id,
    id,
    images: null,
    status: null,
    discount: null,
    extraGuestFee: null,
    amenities: ['WiFi', null, ''],
    capacity: 3.5,
    price: 250.125,
    discountedPrice: 250.125,
    minNights: 1.5,
    createdAt: null,
    updatedAt: '+010000-01-01T00:00:00.000Z',
    __v: null,
  };
  const list = await GET(request());
  expect(list.status).toBe(200);
  const listBody: unknown = await list.json();
  expect(listBody).toEqual({ success: true, data: [expected] });
  expect(cabinListResponseSchema.parse(listBody)).toEqual([expected]);
  const detail = await getById(request(), params(id));
  expect(detail.status).toBe(200);
  const detailBody: unknown = await detail.json();
  expect(detailBody).toEqual({ success: true, data: expected });
  expect(cabinResponseSchema.parse(detailBody)).toEqual(expected);
});

test('deleting by ID returns an explicit null and the existing message', async () => {
  const cabin = await Cabin.create(payload);
  const id = String(cabin._id);
  const response = await deleteById(request({ method: 'DELETE' }), params(id));
  expect(response.status).toBe(200);
  const body: unknown = await response.json();
  expect(body).toEqual({
    success: true,
    data: null,
    message: 'Cabin deleted successfully',
  });
  expect(cabinDeleteResponseSchema.parse(body)).toEqual(body);
  expect(await Cabin.findById(id)).toBeNull();
});

test('preserves list sorting, explicit status and conflicting legacy filter precedence', async () => {
  await Cabin.create(payload);
  await Cabin.create({
    ...payload,
    name: 'Aspen',
    status: 'active',
    capacity: 3,
    discount: 0,
  });
  await Cabin.create({
    ...payload,
    name: 'Cedar',
    status: 'inactive',
    capacity: 7,
    price: 400,
    discount: 50,
  });
  for (const query of [
    {
      search: '?sortBy=price&sortOrder=desc',
      expected: await Cabin.find().sort({ price: -1 }),
    },
    {
      search: '?status=active',
      expected: await Cabin.find({ status: 'active' }).sort({ name: 1 }),
    },
    {
      search: '?status=all&capacity=small&filter=large',
      expected: await Cabin.find({ capacity: { $gte: 7 } }).sort({ name: 1 }),
    },
    {
      search: '?discount=with&filter=no-discount',
      expected: await Cabin.find({ discount: 0 }).sort({ name: 1 }),
    },
  ]) {
    const response = await GET(request({ path: `/api/cabins${query.search}` }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: json(query.expected),
    });
  }
});

test('creation returns complete saved JSON and keeps validation defaults', async () => {
  const response = await POST(request({ method: 'POST', body: payload }));
  expect(response.status).toBe(201);
  const stored = await Cabin.findOne({ name: payload.name });
  expect(stored).not.toBeNull();
  const body: unknown = await response.json();
  const expected = json(stored);
  expect(body).toEqual({ success: true, data: expected });
  expect(cabinResponseSchema.parse(body)).toEqual(expected);
});

test.each(['collection', 'detail'])(
  '%s update returns saved JSON without resetting omitted fields',
  async route => {
    const cabin = await Cabin.create(payload);
    const id = String(cabin._id);
    const input = request({
      method: 'PUT',
      body: { _id: id, name: 'Renamed' },
    });
    const response =
      route === 'collection'
        ? await PUT(input)
        : await updateById(input, params(id));
    expect(response.status).toBe(200);
    const stored = await Cabin.findById(id);
    expect(stored).toMatchObject({
      name: 'Renamed',
      discount: 25,
      status: 'maintenance',
      minNights: 2,
      extraGuestFee: 15,
    });
    const body: unknown = await response.json();
    const expected = json(stored);
    expect(body).toEqual({ success: true, data: expected });
    expect(cabinResponseSchema.parse(body)).toEqual(expected);
  }
);

test('detail PUT preserves omitted null status and persists an explicit Active repair', async () => {
  const cabin = await Cabin.create({ ...payload, status: null });
  const id = String(cabin._id);

  const renamed = await updateById(
    request({ method: 'PUT', body: { _id: id, name: 'Renamed' } }),
    params(id)
  );
  expect(renamed.status).toBe(200);
  expect(cabinResponseSchema.parse(await renamed.json())).toMatchObject({
    name: 'Renamed',
    status: null,
  });
  expect(await Cabin.findById(id).lean()).toMatchObject({ status: null });

  const activated = await updateById(
    request({ method: 'PUT', body: { _id: id, status: 'active' } }),
    params(id)
  );
  expect(activated.status).toBe(200);
  expect(cabinResponseSchema.parse(await activated.json())).toMatchObject({
    name: 'Renamed',
    status: 'active',
  });
  expect(await Cabin.findById(id).lean()).toMatchObject({ status: 'active' });
});

test('missing cabin keeps the 404 envelope without writes', async () => {
  const response = await getById(
    request(),
    params(String(new Types.ObjectId()))
  );
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({
    success: false,
    error: 'Cabin not found',
  });
  expect(await AuditLog.countDocuments()).toBe(0);
});

test('database failure keeps the safe error envelope without writes', async () => {
  jest
    .mocked(connectDB)
    .mockRejectedValueOnce(new Error('Private database detail'));
  const response = await GET(request());
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({
    success: false,
    error: 'Failed to fetch cabins',
  });
  expect(await Cabin.countDocuments()).toBe(0);
  expect(await AuditLog.countDocuments()).toBe(0);
});
