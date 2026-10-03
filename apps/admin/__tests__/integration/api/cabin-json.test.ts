import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { AuditLog, Cabin } from '@lodgeflow/database';
import { GET, POST, PUT } from '@/app/api/cabins/route';
import { GET as getById, PUT as updateById } from '@/app/api/cabins/[id]/route';
import { createErrorResponse, requireApiAuth } from '@/lib/api-utils';
import connectDB from '@/lib/mongodb';

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
  expect(await list.json()).toEqual({ success: true, data: [expected] });
  const detail = await getById(request(), params(String(cabin._id)));
  expect(detail.status).toBe(200);
  expect(await detail.json()).toEqual({ success: true, data: expected });
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
  expect(await response.json()).toEqual({ success: true, data: expected });
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
  expect(await response.json()).toEqual({ success: true, data: json(stored) });
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
    expect(await response.json()).toEqual({
      success: true,
      data: json(stored),
    });
  }
);

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
