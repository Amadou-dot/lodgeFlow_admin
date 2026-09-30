/** @jest-environment node */
import { NextRequest } from 'next/server';
import type { BookingOverlapInput } from '@lodgeflow/database/models/Booking';
import type { ICabin } from '@lodgeflow/database/models/Cabin';

const mockConnect = jest.fn<Promise<void>, []>();
const mockCabin = jest.fn<
  Promise<{ status?: ICabin['status'] } | null>,
  [string]
>();
const mockOverlap = jest.fn<
  Promise<{ checkInDate: Date; checkOutDate: Date }[]>,
  [BookingOverlapInput]
>();
const mockLog = jest.fn();
jest.mock('@lodgeflow/database', () => ({
  connectDB: () => mockConnect(),
  Cabin: { findById: (id: string) => mockCabin(id) },
  Booking: {
    findOverlapping: (input: BookingOverlapInput) => mockOverlap(input),
  },
}));
jest.mock('@lodgeflow/database/logger', () => ({
  logger: { error: (...args: unknown[]) => mockLog(...args) },
}));
import { GET } from '@/app/api/cabins/[id]/availability/route';

const cabinId = '507f1f77bcf86cd7994390ab';
const now = new Date('2030-01-15T12:30:45.123Z');
function calendar({ id = cabinId, query = '' } = {}) {
  return GET(
    new NextRequest(`http://localhost/api/cabins/${id}/availability${query}`),
    {
      params: Promise.resolve({ id }),
    }
  );
}
beforeEach(() => {
  jest.resetAllMocks();
  jest.useFakeTimers({ now });
  mockConnect.mockResolvedValue();
  mockCabin.mockResolvedValue({ status: 'active' });
  mockOverlap.mockResolvedValue([]);
});
afterEach(() => jest.useRealTimers());

describe('cabin calendar characterization', () => {
  test('keeps exact query instants and UTC date-only ranges without mutating bookings', async () => {
    const rows = [
      {
        checkInDate: new Date('2030-06-01T23:30:00-06:00'),
        checkOutDate: new Date('2030-06-04T23:30:00-06:00'),
      },
    ];
    const before = JSON.stringify(rows);
    mockOverlap.mockResolvedValue(rows);
    const query = new URLSearchParams({
      startDate: '2030-06-01T23:30:00-06:00',
      endDate: '2030-06-30T23:30:00-06:00',
    });
    const response = await calendar({
      id: cabinId.toUpperCase(),
      query: `?${query}`,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: {
        cabinId: cabinId.toUpperCase(),
        unavailableDates: [{ start: '2030-06-02', end: '2030-06-05' }],
        queryRange: { start: '2030-06-02', end: '2030-07-01' },
      },
    });
    expect(mockOverlap).toHaveBeenCalledWith({
      cabinId: cabinId.toUpperCase(),
      checkInDate: new Date('2030-06-02T05:30:00Z'),
      checkOutDate: new Date('2030-07-01T05:30:00Z'),
    });
    expect(JSON.stringify(rows)).toBe(before);
  });
  test.each([
    ['', '2030-01-15', '2030-07-15'],
    ['?startDate=&endDate=', '2030-01-15', '2030-07-15'],
    ['?startDate=2030-06-01', '2030-06-01', '2030-07-15'],
    ['?endDate=2030-06-04', '2030-01-15', '2030-06-04'],
    ['?startDate=2030-06-01&endDate=2030-06-04', '2030-06-01', '2030-06-04'],
    [
      '?startDate=2030-06-01&startDate=2035-01-01&endDate=2030-06-04&status=inactive',
      '2030-06-01',
      '2030-06-04',
    ],
  ])('preserves partial/default query %s', async (query, start, end) => {
    const response = await calendar({ query });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: {
        cabinId,
        unavailableDates: [],
        queryRange: { start, end },
      },
    });
    const input = mockOverlap.mock.calls[0][0];
    expect(input.cabinId).toBe(cabinId);
    expect(input.checkInDate.toISOString().slice(0, 10)).toBe(start);
    expect(input.checkOutDate.toISOString().slice(0, 10)).toBe(end);
    if (!query || query.includes('startDate=&'))
      expect(input.checkInDate.getTime()).toBe(now.getTime());
  });
  test('retains calendar-month rollover in the six-month default', async () => {
    const start = new Date(2030, 7, 31, 12, 30);
    const end = new Date(2031, 2, 3, 12, 30);
    jest.setSystemTime(start);
    const response = await calendar();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: {
        queryRange: {
          start: start.toISOString().slice(0, 10),
          end: end.toISOString().slice(0, 10),
        },
      },
    });
  });
  test('keeps the existing sparse-cabin status fallback', async () => {
    mockCabin.mockResolvedValue({});
    expect((await calendar()).status).toBe(200);
  });
  test.each([
    null,
    { status: 'inactive' as const },
    { status: 'maintenance' as const },
  ])('returns 404 for missing or nonpublic cabin %p', async cabin => {
    mockCabin.mockResolvedValue(cabin);
    const response = await calendar();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Cabin not found',
    });
    expect(mockOverlap).not.toHaveBeenCalled();
  });
  test.each(['connection', 'cabin', 'overlap'])(
    'keeps a safe 500 on %s failure',
    async source => {
      const error = new Error('private database details');
      if (source === 'connection') mockConnect.mockRejectedValueOnce(error);
      if (source === 'cabin') mockCabin.mockRejectedValueOnce(error);
      if (source === 'overlap') mockOverlap.mockRejectedValueOnce(error);
      const response = await calendar();
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        success: false,
        error: 'Failed to fetch cabin availability',
      });
    }
  );
});

describe('cabin calendar validation regressions', () => {
  test.each(['invalid', '507f1f77bcf86cd7994390az', '123', ''])(
    'rejects invalid ID %p before connecting',
    async id => {
      const response = await calendar({ id });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        success: false,
        error: 'Invalid cabin ID',
      });
      expect(mockConnect).not.toHaveBeenCalled();
      expect(mockCabin).not.toHaveBeenCalled();
      expect(mockOverlap).not.toHaveBeenCalled();
    }
  );
  test.each([
    '?startDate=invalid',
    '?endDate=invalid',
    '?startDate=%20%20',
    '?startDate=2030-06-04&endDate=2030-06-01',
    '?startDate=2030-06-01&endDate=2030-06-01',
    '?startDate=2031-01-01',
    '?endDate=2029-12-01',
  ])('rejects invalid query %s before connecting', async query => {
    const response = await calendar({ query });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      error: expect.any(String),
    });
    expect(mockConnect).not.toHaveBeenCalled();
    expect(mockCabin).not.toHaveBeenCalled();
    expect(mockOverlap).not.toHaveBeenCalled();
    expect(mockLog).not.toHaveBeenCalled();
  });
  test('logs unexpected failures while retaining a safe response', async () => {
    const error = new Error('private database details');
    mockOverlap.mockRejectedValueOnce(error);
    const response = await calendar();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Failed to fetch cabin availability',
    });
    expect(mockLog).toHaveBeenCalledWith(
      'Error fetching cabin availability',
      error
    );
  });
});
