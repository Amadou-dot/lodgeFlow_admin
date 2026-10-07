import { NextRequest } from 'next/server';
import { Booking, Cabin } from '@lodgeflow/database';
import { GET as dashboard } from '@/app/api/dashboard/route';
import { GET as analytics } from '@/app/api/bookings/analytics/route';
import { GET as sales } from '@/app/api/sales/route';
import { createErrorResponse, requireApiAuth } from '@/lib/api-utils';
import connectDB from '@/lib/mongodb';
import { logger } from '@/lib/logger';

jest.mock('@/lib/mongodb', () => jest.fn().mockResolvedValue(undefined));
jest.mock('@clerk/nextjs/server', () => ({
  clerkClient: async () => ({ users: { getCount: async () => 3 } }),
}));
const request = (period = 'all') =>
  new NextRequest(`https://admin.test/api/bookings/analytics?period=${period}`);
const DAY = 86_400_000;
function json(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(requireApiAuth).mockResolvedValue({
    authenticated: true,
    userId: 'staff',
    role: 'front_desk',
  });
});
afterEach(() => jest.restoreAllMocks());

test('invalid analytics periods fail before database access', async () => {
  const response = await analytics(request('invalid'));
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({
    success: false,
    error: 'Invalid period',
  });
  expect(connectDB).not.toHaveBeenCalled();
});

test.each(['dashboard', 'analytics', 'sales'])(
  '%s logs unexpected failures and keeps its safe error envelope',
  async route => {
    const failure = new Error('private database detail');
    jest.mocked(connectDB).mockRejectedValueOnce(failure);
    const log = jest.spyOn(logger, 'error').mockImplementation(() => {});
    const response = await (route === 'dashboard'
      ? dashboard()
      : route === 'sales'
        ? sales()
        : analytics(request()));
    const error =
      route === 'dashboard'
        ? 'Failed to fetch dashboard statistics'
        : route === 'sales'
          ? 'Failed to fetch sales data'
          : 'Failed to fetch booking analytics';
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      ...(route === 'sales' ? {} : { success: false }),
      error,
    });
    expect(log).toHaveBeenCalledWith(error, failure);
  }
);
async function fixture() {
  const now = new Date();
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
    customer: 'user_guest',
    checkInDate: new Date(now.getTime() - DAY),
    checkOutDate: new Date(now.getTime() + DAY),
    numNights: 2,
    numGuests: 2,
    cabinPrice: 200,
    totalPrice: 200,
    status: 'confirmed',
    payments: [{ id: 'paid', amount: 200, method: 'cash', receivedAt: now }],
    extras: { hasBreakfast: true },
  });
  await Booking.create({
    cabin: cabin._id,
    customer: 'user_guest',
    checkInDate: new Date(now.getTime() + 5 * DAY),
    checkOutDate: new Date(now.getTime() + 8 * DAY),
    numNights: 3,
    numGuests: 1,
    cabinPrice: 300,
    totalPrice: 300,
    status: 'unconfirmed',
  });
  await Booking.create({
    cabin: cabin._id,
    customer: 'user_guest',
    checkInDate: new Date(now.getTime() + 10 * DAY),
    checkOutDate: new Date(now.getTime() + 15 * DAY),
    numNights: 5,
    numGuests: 2,
    cabinPrice: 500,
    totalPrice: 500,
    status: 'cancelled',
  });
  return { cabin, booking };
}

test('dashboard preserves paid-only revenue, cancellation scope, occupancy and serialized recent activity without writes', async () => {
  const { cabin, booking } = await fixture();
  const before = json(await Booking.find().sort({ _id: 1 }).lean());
  const response = await dashboard();
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.data.overview).toEqual({
    totalBookings: 2,
    totalRevenue: 200,
    totalCabins: 1,
    totalCustomers: 3,
    totalCancellations: 1,
    occupancyRate: 50,
    checkInsToday: 0,
    checkOutsToday: 0,
  });
  expect(body.data.recentActivity).toHaveLength(3);
  expect(body.data.recentActivity).toContainEqual({
    id: String(booking._id),
    customerName: 'Customer',
    cabinName: cabin.name,
    checkInDate: booking.checkInDate.toISOString(),
    checkOutDate: booking.checkOutDate.toISOString(),
    totalPrice: 200,
    status: 'confirmed',
    createdAt: booking.createdAt.toISOString(),
  });
  expect(body.data.charts.durations).toEqual([
    { name: '1-2 nights', value: 1, color: '#3b82f6' },
    { name: '3-4 nights', value: 1, color: '#10b981' },
  ]);
  expect(body.data.charts.revenue).toEqual([
    { week: expect.any(String), revenue: 200, bookings: 1 },
  ]);
  expect(json(await Booking.find().sort({ _id: 1 }).lean())).toEqual(before);
});

test('dashboard retains missing-cabin and missing-customer fallbacks', async () => {
  const { cabin } = await fixture();
  await Cabin.deleteOne({ _id: cabin._id });
  const response = await dashboard();
  const body = await response.json();
  expect(
    body.data.recentActivity.every(
      (row: { cabinName: string; customerName: string }) =>
        row.cabinName === 'Unknown' && row.customerName === 'Customer'
    )
  ).toBe(true);
  expect(body.data.charts.occupancy).toEqual([]);
});

test('analytics preserves totals, averages, extras, status counts and catalog revenue semantics', async () => {
  await fixture();
  const response = await analytics(request());
  expect(response.status).toBe(200);
  const { data } = await response.json();
  expect(data.summary).toEqual({
    totalRevenue: 200,
    totalBookings: 2,
    avgBookingValue: 250,
    cancellationRate: 33.3,
  });
  expect(data.popularCabins).toEqual([
    { name: 'Pine', bookingCount: 2, revenue: 500 },
  ]);
  expect(data.statusDistribution).toEqual(
    expect.arrayContaining([
      { status: 'confirmed', count: 1 },
      { status: 'unconfirmed', count: 1 },
      { status: 'cancelled', count: 1 },
    ])
  );
  expect(data.demographics).toEqual({
    avgPartySize: 1.5,
    avgStayLength: 2.5,
    extras: {
      breakfast: { count: 1, rate: 50 },
      pets: { count: 0, rate: 0 },
      parking: { count: 0, rate: 0 },
      earlyCheckIn: { count: 0, rate: 0 },
      lateCheckOut: { count: 0, rate: 0 },
    },
  });
});

test('daily reports retain zero-filled windows and the bare sales envelope', async () => {
  await fixture();
  const recent = await analytics(request('7d'));
  const { data } = await recent.json();
  expect(data.revenueOverTime).toHaveLength(7);
  expect(
    data.revenueOverTime.reduce(
      (total: number, row: { revenue: number }) => total + row.revenue,
      0
    )
  ).toBe(200);
  const response = await sales();
  expect(response.status).toBe(200);
  const rows = await response.json();
  expect(rows).toHaveLength(30);
  expect(
    rows.reduce(
      (total: number, row: { bookings: number }) => total + row.bookings,
      0
    )
  ).toBe(2);
  expect(
    rows.reduce((total: number, row: { sales: number }) => total + row.sales, 0)
  ).toBe(200);
});

test.each(['7d', '30d', '90d', '1y', 'all'])(
  'empty analytics for %s has no fabricated totals',
  async period => {
    const response = await analytics(request(period));
    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data.summary).toEqual({
      totalRevenue: 0,
      totalBookings: 0,
      avgBookingValue: 0,
      cancellationRate: 0,
    });
    expect(data.statusDistribution).toEqual([]);
    expect(data.popularCabins).toEqual([]);
  }
);

test.each(['dashboard', 'analytics', 'sales'])(
  '%s denies before database and provider access',
  async route => {
    const error = createErrorResponse('Denied', 403);
    jest
      .mocked(requireApiAuth)
      .mockResolvedValue({ authenticated: false, error });
    expect(
      await (route === 'dashboard'
        ? dashboard()
        : route === 'sales'
          ? sales()
          : analytics(request()))
    ).toBe(error);
    expect(connectDB).not.toHaveBeenCalled();
  }
);
