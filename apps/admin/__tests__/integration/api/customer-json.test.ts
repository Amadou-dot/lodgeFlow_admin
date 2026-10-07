import { NextRequest } from 'next/server';
import { Booking, Cabin } from '@lodgeflow/database';
import { GET, POST } from '@/app/api/customers/route';
import { GET as getById, PUT } from '@/app/api/customers/[id]/route';
import {
  getClerkUser,
  getClerkUsers,
  searchClerkUsers,
  createCompleteCustomer,
  updateCompleteCustomer,
} from '@/lib/clerk-users';
import { createErrorResponse, requireApiAuth } from '@/lib/api-utils';
import connectDB from '@/lib/mongodb';
import type { Customer } from '@/types/clerk';

jest.mock('@/lib/mongodb', () => jest.fn().mockResolvedValue(undefined));
jest.mock('@/lib/rate-limit', () => ({
  ...jest.requireActual('@/lib/rate-limit'),
  checkRateLimit: jest.fn().mockResolvedValue({ success: true }),
}));
jest.mock('@/lib/clerk-users', () => ({
  ...jest.requireActual('@/lib/clerk-users'),
  getClerkUser: jest.fn(),
  getClerkUsers: jest.fn(),
  searchClerkUsers: jest.fn(),
  createCompleteCustomer: jest.fn(),
  updateCompleteCustomer: jest.fn(),
}));

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
  totalBookings: 0,
  totalSpent: 0,
  loyaltyTier: 'Bronze',
  address: { city: 'Forest' },
  preferences: {
    smokingPreference: 'non-smoking',
    dietaryRestrictions: ['Vegan'],
  },
};
const params = () => ({ params: Promise.resolve({ id: customer.id }) });
const request = (query = '') =>
  new NextRequest(`https://admin.test/api/customers${query}`);
function json(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(requireApiAuth)
    .mockResolvedValue({ authenticated: true, userId: 'staff', role: 'admin' });
  jest.mocked(getClerkUser).mockResolvedValue(customer);
  jest
    .mocked(getClerkUsers)
    .mockResolvedValue({ data: [customer], totalCount: 1 });
  jest
    .mocked(searchClerkUsers)
    .mockResolvedValue({ data: [customer], totalCount: 1 });
  jest.mocked(createCompleteCustomer).mockResolvedValue(customer);
  jest.mocked(updateCompleteCustomer).mockResolvedValue(customer);
});
async function fixture() {
  const cabin = await Cabin.create({
    name: 'Pine',
    description: 'Forest cabin',
    image: 'https://example.invalid/cabin.jpg',
    capacity: 4,
    price: 100,
    discount: 0,
  });
  const booking = await Booking.create({
    cabin: cabin._id,
    customer: customer.id,
    checkInDate: new Date('2040-06-01'),
    checkOutDate: new Date('2040-06-03'),
    numNights: 2,
    numGuests: 2,
    cabinPrice: 200,
    totalPrice: 200,
    status: 'checked-out',
    payments: [
      {
        id: 'paid',
        amount: 200,
        method: 'cash',
        receivedAt: new Date('2040-05-01'),
      },
    ],
  });
  return { cabin, booking };
}

test.each(['', '?search=Test&sortBy=name&sortOrder=asc'])(
  'customer list %s preserves full JSON, computed stats and pagination',
  async query => {
    await fixture();
    const response = await GET(request(query));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: [json({ ...customer, totalBookings: 1, totalSpent: 200 })],
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalCustomers: 1,
        limit: 10,
        hasNextPage: false,
        hasPrevPage: false,
      },
    });
    expect(query ? searchClerkUsers : getClerkUsers).toHaveBeenCalled();
  }
);

test.each([false, true])(
  'customer detail preserves recent booking JSON and null cabin %s',
  async missingCabin => {
    const { booking, cabin } = await fixture();
    if (missingCabin) await Cabin.deleteOne({ _id: cabin._id });
    const stored = await Booking.findById(booking._id)
      .populate('cabin', 'name image capacity price')
      .orFail();
    const response = await getById(request(), params());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: json({
        ...customer,
        totalBookings: 1,
        totalSpent: 200,
        lastBookingDate: booking.createdAt,
        completedBookings: 1,
        totalRevenue: 200,
        averageStayLength: 2,
        recentBookings: [stored],
      }),
    });
  }
);

test('empty history keeps zero totals and omits lastBookingDate', async () => {
  const response = await getById(request(), params());
  expect(await response.json()).toEqual({
    success: true,
    data: json({
      ...customer,
      completedBookings: 0,
      totalRevenue: 0,
      averageStayLength: 0,
      recentBookings: [],
    }),
  });
});

test('missing customer is 404 without database access', async () => {
  jest.mocked(getClerkUser).mockResolvedValue(null);
  const response = await getById(request(), params());
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({
    success: false,
    error: 'Customer not found',
  });
  expect(connectDB).not.toHaveBeenCalled();
});

test.each(['POST', 'PUT'])(
  '%s returns complete customer JSON',
  async method => {
    const req = new NextRequest('https://admin.test/api/customers', {
      method,
      body: JSON.stringify({
        firstName: 'Test',
        lastName: 'Guest',
        email: customer.email,
        password: 'test-password',
      }),
    });
    const response =
      method === 'POST' ? await POST(req) : await PUT(req, params());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: json(customer),
      ...(method === 'POST'
        ? { message: 'Customer created successfully' }
        : {}),
    });
  }
);

test.each(['list', 'detail', 'create', 'update'])(
  '%s denies before Clerk or database access',
  async operation => {
    const error = createErrorResponse('Denied', 403);
    jest
      .mocked(requireApiAuth)
      .mockResolvedValue({ authenticated: false, error });
    const response =
      operation === 'list'
        ? await GET(request())
        : operation === 'detail'
          ? await getById(request(), params())
          : operation === 'create'
            ? await POST(request())
            : await PUT(request(), params());
    expect(response).toBe(error);
    for (const dependency of [
      getClerkUser,
      getClerkUsers,
      createCompleteCustomer,
      updateCompleteCustomer,
      connectDB,
    ])
      expect(dependency).not.toHaveBeenCalled();
  }
);

test.each(['POST', 'PUT'])(
  '%s rejects malformed JSON without a provider mutation',
  async method => {
    const req = new NextRequest('https://admin.test/api/customers', {
      method,
      body: '{',
    });
    const response =
      method === 'POST' ? await POST(req) : await PUT(req, params());
    expect(response.status).toBe(400);
    expect(createCompleteCustomer).not.toHaveBeenCalled();
    expect(updateCompleteCustomer).not.toHaveBeenCalled();
  }
);

test.each([
  null,
  [],
  { firstName: 17 },
  { banned: true },
  { role: 'admin' },
  { totalSpent: 10000 },
  { 'address.city': 'Injected' },
  { address: { $set: { city: 'Injected' } } },
  { preferences: { smokingPreference: 'anything' } },
])('PUT rejects invalid or server-owned fields: %p', async body => {
  const response = await PUT(
    new NextRequest('https://admin.test/api/customers', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
    params()
  );
  expect(response.status).toBe(400);
  expect(updateCompleteCustomer).not.toHaveBeenCalled();
});

test('creation retains the metadata entered by the guest form', async () => {
  const input = {
    firstName: 'Test',
    lastName: 'Guest',
    email: customer.email,
    password: 'test-password',
    emergencyContact: {
      firstName: 'Emergency',
      lastName: 'Contact',
      phone: '18005551234',
      relationship: 'Family',
    },
    preferences: {
      smokingPreference: 'non-smoking',
      dietaryRestrictions: ['Vegan'],
      accessibilityNeeds: ['Step-free'],
    },
  };
  const response = await POST(
    new NextRequest('https://admin.test/api/customers', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  );
  expect(response.status).toBe(200);
  expect(createCompleteCustomer).toHaveBeenCalledWith(
    expect.objectContaining({
      emergencyContact: input.emergencyContact,
      preferences: input.preferences,
    })
  );
});

test('unexpected list and create failures never expose provider messages', async () => {
  jest
    .mocked(getClerkUsers)
    .mockRejectedValueOnce(new Error('private provider detail'));
  const list = await GET(request());
  expect(list.status).toBe(500);
  expect(await list.json()).toEqual({
    success: false,
    error: 'Failed to fetch customers',
  });
  jest
    .mocked(createCompleteCustomer)
    .mockRejectedValueOnce(new Error('private provider detail'));
  const create = await POST(
    new NextRequest('https://admin.test/api/customers', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'Test',
        lastName: 'Guest',
        email: customer.email,
        password: 'test-password',
      }),
    })
  );
  expect(create.status).toBe(500);
  expect(await create.json()).toEqual({
    success: false,
    error: 'Failed to create customer',
  });
});
