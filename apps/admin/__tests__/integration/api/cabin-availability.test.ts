import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { Booking } from '@lodgeflow/database';
import type { IBooking } from '@lodgeflow/database/models/Booking';
import { GET } from '@/app/api/cabins/[id]/availability/route';
import { createErrorResponse, requireApiAuth } from '@/lib/api-utils';
import connectDB from '@/lib/mongodb';
import { logger } from '@/lib/logger';

jest.mock('@/lib/mongodb', () => jest.fn().mockResolvedValue(undefined));
jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn() },
}));

const cabinId = new Types.ObjectId();
const range = 'startDate=2040-06-01&endDate=2040-06-10';
function invoke({
  id = String(cabinId),
  query = range,
}: { id?: string; query?: string } = {}) {
  return GET(
    new NextRequest(
      `https://admin.test/api/cabins/${id}/availability?${query}`
    ),
    { params: Promise.resolve({ id }) }
  );
}
function booking({
  cabin = cabinId,
  checkInDate = new Date('2040-06-03T00:00:00Z'),
  checkOutDate = new Date('2040-06-05T00:00:00Z'),
  status = 'confirmed',
}: {
  cabin?: Types.ObjectId;
  checkInDate?: Date;
  checkOutDate?: Date;
  status?: IBooking['status'];
} = {}) {
  return Booking.create({
    cabin,
    customer: 'user_guest',
    checkInDate,
    checkOutDate,
    numNights: 2,
    numGuests: 1,
    cabinPrice: 200,
    totalPrice: 400,
    status,
  });
}
async function snapshot() {
  return JSON.stringify(await Booking.find().sort({ _id: 1 }).lean());
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(requireApiAuth).mockResolvedValue({
    authenticated: true,
    userId: 'user_front_desk',
    role: 'front_desk',
  });
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('cabin availability characterization', () => {
  test.each([401, 403])(
    'denies %i before database or parameter access',
    async status => {
      const error = createErrorResponse('Denied', status);
      jest
        .mocked(requireApiAuth)
        .mockResolvedValue({ authenticated: false, error });
      expect(await invoke({ id: 'bad', query: 'startDate=bad' })).toBe(error);
      expect(requireApiAuth).toHaveBeenCalledWith({
        permission: 'bookings:read',
      });
      expect(connectDB).not.toHaveBeenCalled();
    }
  );

  test.each<IBooking['status']>([
    'unconfirmed',
    'confirmed',
    'checked-in',
    'checked-out',
    'cancelled',
  ])(
    'preserves %s visibility and date-only JSON without writes',
    async status => {
      await booking({ status });
      const before = await snapshot();
      const response = await invoke();
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        success: true,
        data: {
          cabinId: String(cabinId),
          unavailableDates:
            status === 'cancelled'
              ? []
              : [{ start: '2040-06-03', end: '2040-06-05' }],
          queryRange: { start: '2040-06-01', end: '2040-06-10' },
        },
      });
      expect(await snapshot()).toBe(before);
    }
  );

  test('uses strict overlap boundaries and scopes rows to the cabin', async () => {
    await booking({
      checkInDate: new Date('2040-05-29'),
      checkOutDate: new Date('2040-06-01'),
    });
    await booking({
      checkInDate: new Date('2040-06-10'),
      checkOutDate: new Date('2040-06-12'),
    });
    await booking({
      checkInDate: new Date('2040-05-30'),
      checkOutDate: new Date('2040-06-11'),
    });
    await booking({ cabin: new Types.ObjectId() });
    const response = await invoke();
    expect(response.status).toBe(200);
    expect((await response.json()).data.unavailableDates).toEqual([
      { start: '2040-05-30', end: '2040-06-11' },
    ]);
  });

  test('excludes only the chosen booking and retains other unavailable spans', async () => {
    const own = await booking();
    await booking({
      checkInDate: new Date('2040-06-06'),
      checkOutDate: new Date('2040-06-08'),
    });
    const before = await snapshot();
    const response = await invoke({
      query: `${range}&excludeBookingId=${own._id}`,
    });
    expect(response.status).toBe(200);
    expect((await response.json()).data.unavailableDates).toEqual([
      { start: '2040-06-06', end: '2040-06-08' },
    ]);
    expect(await snapshot()).toBe(before);
  });

  test('accepts uppercase IDs and valid nonexistent exclusions without inventing cabin existence checks', async () => {
    const response = await invoke({
      id: String(cabinId).toUpperCase(),
      query: `${range}&excludeBookingId=${new Types.ObjectId()}`,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: {
        cabinId: String(cabinId).toUpperCase(),
        unavailableDates: [],
        queryRange: { start: '2040-06-01', end: '2040-06-10' },
      },
    });
  });

  test('retains invalid exclusion precedence over invalid dates', async () => {
    const before = await snapshot();
    const response = await invoke({
      query: 'startDate=bad&excludeBookingId=bad',
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Invalid excludeBookingId format',
    });
    expect(await snapshot()).toBe(before);
  });

  test('preserves timestamp parsing and UTC date-only output', async () => {
    await booking({
      checkInDate: new Date('2040-06-03T23:00:00-05:00'),
      checkOutDate: new Date('2040-06-05T23:00:00-05:00'),
    });
    const response = await invoke({
      query: new URLSearchParams({
        startDate: '2040-06-01T23:00:00-05:00',
        endDate: '2040-06-09T23:00:00-05:00',
      }).toString(),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: {
        cabinId: String(cabinId),
        unavailableDates: [{ start: '2040-06-04', end: '2040-06-06' }],
        queryRange: { start: '2040-06-02', end: '2040-06-10' },
      },
    });
  });

  test('defaults empty dates/exclusion to the current six-month window', async () => {
    const start = new Date();
    const end = new Date();
    end.setMonth(end.getMonth() + 6);
    const within = new Date(start);
    within.setMonth(within.getMonth() + 1);
    const withinEnd = new Date(within);
    withinEnd.setDate(withinEnd.getDate() + 2);
    await booking({ checkInDate: within, checkOutDate: withinEnd });
    const beyond = new Date(start);
    beyond.setMonth(beyond.getMonth() + 7);
    const beyondEnd = new Date(beyond);
    beyondEnd.setDate(beyondEnd.getDate() + 2);
    await booking({ checkInDate: beyond, checkOutDate: beyondEnd });
    const response = await invoke({
      query: 'startDate=&endDate=&excludeBookingId=',
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: {
        cabinId: String(cabinId),
        unavailableDates: [
          {
            start: within.toISOString().split('T')[0],
            end: withinEnd.toISOString().split('T')[0],
          },
        ],
        queryRange: {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0],
        },
      },
    });
  });
});

describe('cabin availability regressions', () => {
  test.each([
    { id: 'bad', query: range, message: 'Invalid cabinId format' },
    {
      id: String(cabinId),
      query: 'startDate=bad&endDate=2040-06-10',
      message: 'Invalid startDate',
    },
    {
      id: String(cabinId),
      query: 'startDate=2040-06-01&endDate=bad',
      message: 'Invalid endDate',
    },
    {
      id: String(cabinId),
      query: 'startDate=2040-06-10&endDate=2040-06-01',
      message: 'endDate must be after startDate',
    },
    {
      id: String(cabinId),
      query: 'startDate=2040-06-01&endDate=2040-06-01',
      message: 'endDate must be after startDate',
    },
  ])(
    'rejects invalid query before reading bookings: $message',
    async ({ id, query, message }) => {
      const before = await snapshot();
      const find = jest.spyOn(Booking, 'find');
      const response = await invoke({ id, query });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ success: false, error: message });
      expect(find).not.toHaveBeenCalled();
      expect(await snapshot()).toBe(before);
    }
  );

  test('logs unexpected read failures while preserving the safe 500 response', async () => {
    const fault = new Error('Private database detail');
    jest.spyOn(Booking, 'find').mockImplementationOnce(() => {
      throw fault;
    });
    const response = await invoke();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Failed to fetch cabin availability',
    });
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to fetch cabin availability',
      fault
    );
  });
});
