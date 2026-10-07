import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { Booking, Cabin } from '@lodgeflow/database';
import { GET } from '@/app/api/bookings/route';
import { GET as getById, PATCH } from '@/app/api/bookings/[id]/route';
import { getClerkUser, getClerkUsersBatch } from '@/lib/clerk-users';
import { createErrorResponse, requireApiAuth } from '@/lib/api-utils';
import connectDB from '@/lib/mongodb';
import type { Customer } from '@/types/clerk';

jest.mock('@/lib/mongodb', () => jest.fn().mockResolvedValue(undefined));
const customer: Customer = {
  id: 'user_guest',
  name: 'Test Guest',
  email: 'guest@example.invalid',
  username: null,
  first_name: 'Test',
  last_name: 'Guest',
  image_url: '',
  has_image: false,
  created_at: new Date('2030-01-01'),
  updated_at: new Date('2030-02-01'),
  last_sign_in_at: null,
  last_active_at: new Date('2030-03-01'),
  banned: false,
  locked: false,
  lockout_expires_in_seconds: null,
  totalBookings: 2,
  totalSpent: 400,
  loyaltyTier: 'Bronze',
  lastBookingDate: new Date('2030-06-01'),
};
const request = () => new NextRequest('https://admin.test/api/bookings');
const params = (id: string) => ({ params: Promise.resolve({ id }) });
function json(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}
async function fixture() {
  const cabin = await Cabin.create({
    name: 'Pine',
    description: 'A peaceful forest cabin',
    image: 'https://example.invalid/cabin.jpg',
    capacity: 4,
    price: 200,
    discount: 25,
    amenities: ['WiFi'],
  });
  const booking = await Booking.create({
    cabin: cabin._id,
    customer: customer.id,
    checkInDate: new Date('2040-06-01'),
    checkOutDate: new Date('2040-06-03'),
    numNights: 2,
    numGuests: 2,
    cabinPrice: 400,
    totalPrice: 400,
    depositAmount: 100,
    payments: [
      {
        id: 'receipt_1',
        amount: 100,
        method: 'cash',
        receivedAt: new Date('2040-05-01'),
      },
    ],
    observations: 'Late arrival',
    specialRequests: ['Quiet cabin'],
    status: 'confirmed',
  });
  return { cabin, booking };
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(requireApiAuth).mockResolvedValue({
    authenticated: true,
    userId: 'user_staff',
    role: 'front_desk',
  });
  jest.mocked(getClerkUser).mockResolvedValue(customer);
  jest.mocked(getClerkUsersBatch).mockResolvedValue({
    users: new Map([[customer.id, customer]]),
    errors: 0,
  });
});
afterEach(() => jest.restoreAllMocks());

test('list preserves its cabin projection, complete receipt JSON, virtuals and customer dates', async () => {
  const { booking, cabin } = await fixture();
  const stored = await Booking.findById(booking._id)
    .populate('cabin', 'name image capacity price discount')
    .orFail();
  const expected = json({
    ...stored.toObject(),
    customer,
    guest: customer,
    cabinName: cabin.name,
  });
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    success: true,
    data: [expected],
    pagination: {
      currentPage: 1,
      totalPages: 1,
      totalBookings: 1,
      limit: 10,
      hasNextPage: false,
      hasPrevPage: false,
    },
  });
});

test('detail preserves full cabin and customer JSON', async () => {
  const { booking, cabin } = await fixture();
  const stored = await Booking.findById(booking._id).populate('cabin').orFail();
  const response = await getById(request(), params(String(booking._id)));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    success: true,
    data: json({
      ...stored.toObject(),
      customer,
      guest: customer,
      cabinName: cabin.name,
    }),
  });
});

test('list keeps its unknown-customer fallback and warning while detail keeps null', async () => {
  const { booking, cabin } = await fixture();
  jest
    .mocked(getClerkUsersBatch)
    .mockResolvedValue({ users: new Map(), errors: 1 });
  jest.mocked(getClerkUser).mockResolvedValue(null);
  const list = await GET(request());
  const body = await list.json();
  expect(body.data[0].customer).toEqual({
    id: customer.id,
    name: 'Unknown User',
    email: 'N/A',
  });
  expect(body.data[0].guest).toEqual(body.data[0].customer);
  expect(body._clerkWarning).toBe(
    'Failed to fetch 1 customer record(s) from Clerk. Some customer data may be unavailable.'
  );
  const detail = await getById(request(), params(String(booking._id)));
  const stored = await Booking.findById(booking._id).populate('cabin').orFail();
  expect(await detail.json()).toEqual({
    success: true,
    data: json({
      ...stored.toObject(),
      customer: null,
      guest: null,
      cabinName: cabin.name,
    }),
  });
});

test('missing populated cabin remains null and omits cabinName in both reads', async () => {
  const { booking, cabin } = await fixture();
  await Cabin.deleteOne({ _id: cabin._id });
  for (const response of [
    await GET(request()),
    await getById(request(), params(String(booking._id))),
  ]) {
    expect(response.status).toBe(200);
    const body = await response.json();
    const row = Array.isArray(body.data) ? body.data[0] : body.data;
    expect(row.cabin).toBeNull();
    expect(row).not.toHaveProperty('cabinName');
  }
});

test('status mutation preserves full post-save JSON and customer hydration', async () => {
  const { booking, cabin } = await fixture();
  const response = await PATCH(
    new NextRequest('https://admin.test/api/bookings/id', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'checked-in' }),
    }),
    params(String(booking._id))
  );
  expect(response.status).toBe(200);
  const stored = await Booking.findById(booking._id).populate('cabin').orFail();
  expect(await response.json()).toEqual({
    success: true,
    data: json({
      ...stored.toObject(),
      customer,
      guest: customer,
      cabinName: cabin.name,
    }),
  });
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
        : await getById(request(), params(String(new Types.ObjectId())))
    ).toBe(error);
    expect(connectDB).not.toHaveBeenCalled();
  }
);
