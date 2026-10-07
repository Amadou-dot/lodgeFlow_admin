/** @jest-environment node */
import { NextRequest } from 'next/server';
import { logger } from '@lodgeflow/database/logger';
const mockConnect = jest.fn();
const mockCatalog = jest.fn();
const mockRows = jest.fn(() => [
  { date: new Date('2040-06-01'), numGuests: 3, numParticipants: 3 },
]);
const mockFind = jest.fn((..._args: unknown[]) => ({
  lean: async () => mockRows(),
  select: () => ({ lean: async () => mockRows() }),
}));
jest.mock('@lodgeflow/database', () => ({
  connectDB: () => mockConnect(),
  Dining: { findById: () => mockCatalog() },
  Experience: { findById: () => mockCatalog() },
  DiningReservation: { find: (...args: unknown[]) => mockFind(...args) },
  ExperienceBooking: { find: (...args: unknown[]) => mockFind(...args) },
}));
import { GET as dining } from '@/app/api/dining/[id]/availability/route';
import { GET as experience } from '@/app/api/experiences/[id]/availability/route';
const id = '507f1f77bcf86cd799439011';
const params = { params: Promise.resolve({ id }) };
const request = (query: string) =>
  new NextRequest(`https://customer.test?${query}`);
beforeEach(() => {
  jest.clearAllMocks();
  mockConnect.mockResolvedValue(undefined);
  mockCatalog.mockResolvedValue({
    maxPeople: 4,
    maxParticipants: 4,
    servingTime: { start: '17:00', end: '22:00' },
    available: ['Monday'],
  });
});
afterEach(() => jest.restoreAllMocks());
for (const route of [dining, experience]) {
  test('day reads preserve saved counts, local day bounds and original date text', async () => {
    const response = await route(
      request('date=2040-06-01&startDate=ignored&endDate=ignored'),
      params
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toMatchObject({
      date: '2040-06-01',
      isAvailable: true,
      [route === dining ? 'seatsRemaining' : 'spotsRemaining']: 1,
    });
    const start = new Date('2040-06-01');
    start.setHours(0, 0, 0, 0);
    const end = new Date('2040-06-01');
    end.setHours(23, 59, 59, 999);
    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        date: { $gte: start, $lt: end },
        status: {
          $nin: route === dining ? ['cancelled', 'no-show'] : ['cancelled'],
        },
      })
    );
  });
  test('range reads retain inclusive bounds, 180-day cap and full-day capacity grouping', async () => {
    mockRows.mockReturnValueOnce([
      { date: new Date('2040-06-01'), numGuests: 4, numParticipants: 4 },
    ]);
    const response = await route(
      request('startDate=2040-06-01&endDate=2041-06-01'),
      params
    );
    const body = await response.json();
    const start = new Date('2040-06-01');
    const end = new Date(start.getTime() + 180 * 86400000);
    expect(body.data.fullyBookedDates).toEqual(['2040-06-01']);
    expect(body.data.queryRange).toEqual({
      start: '2040-06-01',
      end: end.toISOString().slice(0, 10),
    });
    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({ date: { $gte: start, $lte: end } })
    );
  });
  test('unlimited capacity retains JSON null and available=true', async () => {
    mockCatalog.mockResolvedValueOnce({
      servingTime: { start: '17:00', end: '22:00' },
    });
    const response = await route(request('date=2040-06-01'), params);
    const body = await response.json();
    expect(body.data).toMatchObject({
      isAvailable: true,
      [route === dining ? 'seatsRemaining' : 'spotsRemaining']: null,
    });
  });
  test.each([
    'date=bad',
    'startDate=bad',
    'endDate=bad',
    'startDate=2040-06-02&endDate=2040-06-01',
  ])('invalid query %s fails before effects', async query => {
    expect((await route(request(query), params)).status).toBe(400);
    expect(mockConnect).not.toHaveBeenCalled();
    expect(mockCatalog).not.toHaveBeenCalled();
  });
  test('invalid ID is 404 before connection', async () => {
    expect(
      (
        await route(request('date=2040-06-01'), {
          params: Promise.resolve({ id: 'bad' }),
        })
      ).status
    ).toBe(404);
    expect(mockConnect).not.toHaveBeenCalled();
  });
  test('unexpected failures are safely logged', async () => {
    const error = new Error('private detail');
    const log = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockConnect.mockRejectedValueOnce(error);
    const response = await route(request('date=2040-06-01'), params);
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('private');
    expect(log).toHaveBeenCalledWith(expect.any(String), error);
  });
}
test('dining rejects malformed time before connecting', async () => {
  expect(
    (await dining(request('date=2040-06-01&time=25:00'), params)).status
  ).toBe(400);
  expect(mockConnect).not.toHaveBeenCalled();
});
test('dining outside-window time returns unavailable without querying reservations', async () => {
  const response = await dining(request('date=2040-06-01&time=12:00'), params);
  expect((await response.json()).data).toMatchObject({
    seatsRemaining: 0,
    time: '12:00',
    isAvailable: false,
  });
  expect(mockFind).not.toHaveBeenCalled();
});
