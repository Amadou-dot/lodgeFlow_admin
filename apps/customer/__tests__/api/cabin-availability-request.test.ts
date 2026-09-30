/** @jest-environment node */
import { NextRequest } from 'next/server';
import CabinModel from '@lodgeflow/database/models/Cabin';

const mockConnect = jest.fn<Promise<void>, []>();
const mockSort = jest.fn<
  Promise<InstanceType<typeof CabinModel>[]>,
  [object]
>();
const mockFind = jest.fn<{ sort: typeof mockSort }, [object]>(() => ({
  sort: mockSort,
}));
const mockBookings = jest.fn<Promise<[]>, [object]>();
const mockLog = jest.fn();
jest.mock('@lodgeflow/database', () => ({
  connectDB: () => mockConnect(),
  Cabin: { find: (query: object) => mockFind(query) },
  Booking: { find: (query: object) => mockBookings(query) },
}));
jest.mock('@lodgeflow/database/logger', () => ({
  logger: { error: (...args: unknown[]) => mockLog(...args) },
}));
import { POST } from '@/app/api/cabins/availability/route';

const valid = {
  checkInDate: '2030-06-01',
  checkOutDate: '2030-06-04',
  guests: 4,
};
const requiredFields =
  'Missing required fields: checkInDate, checkOutDate, guests';
function request(body: unknown) {
  return raw(JSON.stringify(body));
}
function raw(body: string) {
  return POST(
    new NextRequest('http://localhost/api/cabins/availability', {
      method: 'POST',
      body,
    })
  );
}
function expectNoDatabaseAccess() {
  expect(mockConnect).not.toHaveBeenCalled();
  expect(mockFind).not.toHaveBeenCalled();
  expect(mockBookings).not.toHaveBeenCalled();
}
beforeEach(() => {
  jest.resetAllMocks();
  mockConnect.mockResolvedValue();
  mockFind.mockReturnValue({ sort: mockSort });
  mockSort.mockResolvedValue([]);
  mockBookings.mockResolvedValue([]);
});

describe('availability request characterization', () => {
  test.each([
    ['2030-06-01', '2030-06-04'],
    ['2030-06-01T15:45:00-06:00', '2030-06-04T11:30:00-06:00'],
  ])('preserves the exact query instants from %s to %s', async (start, end) => {
    const cabin = new CabinModel({
      _id: '507f1f77bcf86cd799439011',
      name: 'Pine',
      description: 'Cabin',
      image: 'https://example.invalid/cabin.jpg',
      price: 100,
      capacity: 4,
    });
    mockSort.mockResolvedValue([cabin]);
    const response = await request({
      ...valid,
      checkInDate: start,
      checkOutDate: end,
      customer: 'ignored',
      status: 'inactive',
    });
    expect(response.status).toBe(200);
    expect(mockFind).toHaveBeenCalledWith({
      status: 'active',
      capacity: { $gte: 4 },
    });
    expect(mockSort).toHaveBeenCalledWith({ price: 1 });
    expect(mockBookings).toHaveBeenCalledWith({
      cabin: cabin._id,
      status: { $nin: ['cancelled'] },
      $or: [
        {
          checkInDate: { $lt: new Date(end) },
          checkOutDate: { $gt: new Date(start) },
        },
      ],
    });
  });
  test('returns an empty success envelope when the active catalog has no matches', async () => {
    const response = await request(valid);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, data: [] });
    expect(mockBookings).not.toHaveBeenCalled();
  });
  test.each([
    {},
    { ...valid, checkInDate: '' },
    { ...valid, checkOutDate: '' },
    { ...valid, guests: 0 },
  ])('preserves the missing-field response for %p', async body => {
    const response = await request(body);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      error: requiredFields,
    });
    expect(mockFind).not.toHaveBeenCalled();
    expect(mockBookings).not.toHaveBeenCalled();
  });
  test.each(['2030-06-01', '2030-05-31'])(
    'preserves the ordering response for checkout %s',
    async end => {
      const response = await request({ ...valid, checkOutDate: end });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        success: false,
        error: 'Check-out date must be after check-in date',
      });
      expect(mockFind).not.toHaveBeenCalled();
      expect(mockBookings).not.toHaveBeenCalled();
    }
  );
  test.each(['connection', 'catalog', 'bookings'])(
    'keeps a safe logged 500 for a %s failure',
    async source => {
      const error = new Error('private database detail');
      if (source === 'connection') mockConnect.mockRejectedValueOnce(error);
      if (source === 'catalog') mockSort.mockRejectedValueOnce(error);
      if (source === 'bookings') {
        mockSort.mockResolvedValue([new CabinModel({ name: 'Pine' })]);
        mockBookings.mockRejectedValueOnce(error);
      }
      const response = await request(valid);
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        success: false,
        error: 'Failed to check availability',
      });
      expect(mockLog).toHaveBeenCalledWith(
        'Error checking availability',
        error
      );
    }
  );
  test('treats a body-stream failure as a server error', async () => {
    const error = new Error('private stream details');
    const req = new NextRequest('http://localhost/api/cabins/availability', {
      method: 'POST',
      body: new ReadableStream({
        start(controller) {
          controller.error(error);
        },
      }),
    });
    const response = await POST(req);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Failed to check availability',
    });
    expect(mockLog).toHaveBeenCalledWith('Error checking availability', error);
  });
});

describe('availability request regressions', () => {
  test.each(['{', ''])(
    'rejects malformed JSON %p before connecting',
    async body => {
      const response = await raw(body);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        success: false,
        error: 'Invalid JSON body',
      });
      expectNoDatabaseAccess();
      expect(mockLog).not.toHaveBeenCalled();
    }
  );
  test.each([
    null,
    [],
    'stay',
    123,
    true,
    { ...valid, checkInDate: null },
    { ...valid, checkInDate: false },
    { ...valid, checkInDate: 1900000000000 },
    { ...valid, checkInDate: ['2030-06-01'] },
    { ...valid, checkInDate: { $gt: '' } },
    { ...valid, checkInDate: 'invalid' },
    { ...valid, checkOutDate: 'invalid' },
    { ...valid, checkInDate: '   ' },
    { ...valid, guests: '4' },
    { ...valid, guests: -1 },
    { ...valid, guests: 1.5 },
    { ...valid, guests: [] },
    { ...valid, guests: { $gt: 0 } },
    {},
    { ...valid, checkOutDate: '2030-05-31' },
  ])('rejects invalid input %p before database access', async body => {
    const response = await request(body);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      error: expect.any(String),
    });
    expectNoDatabaseAccess();
    expect(mockLog).not.toHaveBeenCalled();
  });
});
