import {
  Booking,
  Cabin,
  Dining,
  DiningReservation,
  Experience,
  ExperienceBooking,
} from '@lodgeflow/database';
import { Types } from 'mongoose';
import { GET as inbox } from '@/app/api/reservations/route';
import { GET as cabins } from '@/app/api/calendar/cabins/route';
import { GET as diningCalendar } from '@/app/api/calendar/dining/route';
import { GET as experiences } from '@/app/api/calendar/experiences/route';
import { requireApiAuth, createErrorResponse } from '@/lib/api-utils';
import connectDB from '@/lib/mongodb';
import { logger } from '@/lib/logger';
jest.mock('@/lib/mongodb', () => jest.fn().mockResolvedValue(undefined));
const start = new Date('2030-06-01');
const end = new Date('2030-07-01');
const request = (query = '') =>
  new Request(
    'https://admin.test/api/calendar?start=2030-06-01&end=2030-07-01' + query
  );
function json(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(requireApiAuth).mockResolvedValue({
    authenticated: true,
    userId: 'user_staff',
    role: 'front_desk',
  });
});
afterEach(() => jest.restoreAllMocks());

async function fixtures() {
  const cabin = await Cabin.create({
    name: 'Cabin',
    description: 'Test',
    image: 'https://example.invalid/a.jpg',
    price: 100,
    capacity: 4,
  });
  const dining = await Dining.create({
    name: 'Dinner',
    description: 'Test',
    image: 'https://example.invalid/d.jpg',
    price: 20,
    type: 'menu',
    mealType: 'dinner',
    category: 'regular',
    servingTime: { start: '12:00', end: '22:00' },
    maxPeople: 10,
  });
  const experience = await Experience.create({
    name: 'Walk',
    description: 'Test',
    image: 'https://example.invalid/e.jpg',
    price: 30,
    duration: '2h',
    available: ['Monday'],
    difficulty: 'Easy',
    category: 'Outdoor',
    ctaText: 'Book',
  });
  await Booking.create({
    cabin: cabin._id,
    customer: 'missing_guest',
    checkInDate: start,
    checkOutDate: new Date('2030-06-03'),
    numGuests: 2,
    cabinPrice: 200,
    totalPrice: 200,
    status: 'confirmed',
  });
  await DiningReservation.create({
    dining: dining._id,
    customer: 'missing_guest',
    date: start,
    time: '19:00',
    numGuests: 2,
    totalPrice: 40,
    status: 'seated',
  });
  await ExperienceBooking.create({
    experience: experience._id,
    customer: 'missing_guest',
    date: start,
    numParticipants: 3,
    totalPrice: 90,
  });
  return { cabin, dining, experience };
}

test('cabin calendar preserves the exact lean projection and ISO range', async () => {
  await fixtures();
  const expected = {
    resources: await Cabin.find()
      .select('name status')
      .sort({ name: 1 })
      .lean(),
    reservations: await Booking.find()
      .select('cabin checkInDate checkOutDate status customer')
      .sort({ checkInDate: 1, _id: 1 })
      .lean(),
    start: start.toISOString(),
    end: end.toISOString(),
  };
  const response = await cabins(request());
  expect(await response.json()).toEqual({
    success: true,
    data: json(expected),
  });
});
test('capacity calendars preserve seating/day grouping, sparse capacity and selected fields', async () => {
  const f = await fixtures();
  const dining = await diningCalendar(request());
  expect(await dining.json()).toEqual({
    success: true,
    data: {
      resources: json(
        await Dining.find()
          .select('name maxPeople isAvailable servingTime')
          .lean()
      ),
      usage: [
        {
          _id: {
            resourceId: String(f.dining._id),
            date: '2030-06-01',
            time: '19:00',
          },
          used: 2,
        },
      ],
      start: start.toISOString(),
      end: end.toISOString(),
    },
  });
  const experience = await experiences(request());
  expect(await experience.json()).toEqual({
    success: true,
    data: {
      resources: json(
        await Experience.find().select('name maxParticipants').lean()
      ),
      usage: [
        {
          _id: { resourceId: String(f.experience._id), date: '2030-06-01' },
          used: 3,
        },
      ],
      start: start.toISOString(),
      end: end.toISOString(),
    },
  });
});
test('inbox preserves native seated status, nullable times, dates and missing listing/customer fallbacks', async () => {
  const f = await fixtures();
  await Dining.deleteOne({ _id: f.dining._id });
  const row = await DiningReservation.findOne()
    .lean<{ _id: Types.ObjectId; createdAt: Date }>()
    .orFail();
  const response = await inbox(
    new Request('https://admin.test/api/reservations?type=dining')
  );
  expect(await response.json()).toEqual({
    success: true,
    data: {
      rows: [
        {
          _id: String(row._id),
          type: 'dining',
          date: start.toISOString(),
          endDate: null,
          time: '19:00',
          partySize: 2,
          resourceId: String(f.dining._id),
          customer: 'missing_guest',
          status: 'seated',
          totalPrice: 40,
          isPaid: false,
          createdAt: row.createdAt.toISOString(),
          lifecycle: 'seated',
          resourceName: 'Removed listing',
          customerName: 'Unavailable guest',
        },
      ],
      total: 1,
      page: 1,
      limit: 25,
    },
  });
});
test('inbox returns the empty paginated envelope', async () => {
  const response = await inbox(
    new Request(
      'https://admin.test/api/reservations?resourceId=' + new Types.ObjectId()
    )
  );
  expect(await response.json()).toEqual({
    success: true,
    data: { rows: [], total: 0, page: 1, limit: 25 },
  });
});
test.each([inbox, cabins, diningCalendar, experiences])(
  'read permissions deny before connection',
  async route => {
    jest.mocked(requireApiAuth).mockResolvedValueOnce({
      authenticated: false,
      error: createErrorResponse('Permission denied', 403),
    });
    expect((await route(request())).status).toBe(403);
    expect(connectDB).not.toHaveBeenCalled();
  }
);

test.each([
  ['inbox', inbox, 'Unable to load reservations'],
  ['calendar', cabins, 'Unable to load calendar'],
] as const)(
  '%s logs unexpected failures while returning a safe error',
  async (_name, route, message) => {
    const failure = new Error('private database detail');
    jest.mocked(connectDB).mockRejectedValueOnce(failure);
    const log = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    const response = await route(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, error: message });
    expect(log).toHaveBeenCalledWith(message, failure);
  }
);

test.each([
  ['page=0', 'Invalid pagination'],
  ['limit=101', 'Invalid pagination'],
  ['type=unknown', 'Invalid reservation type'],
  ['lifecycle=seated', 'Invalid lifecycle'],
  ['resourceId=bad', 'Invalid listing'],
  ['from=bad', 'Invalid date'],
  ['from=2030-06-01&to=2030-06-01', 'Invalid date range'],
])('inbox validates %s before connection', async (query, error) => {
  const response = await inbox(
    new Request('https://admin.test/api/reservations?' + query)
  );
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ success: false, error });
  expect(connectDB).not.toHaveBeenCalled();
});
test('calendar preserves UTC midnight normalization and same-day rejection', async () => {
  const response = await cabins(
    new Request(
      'https://admin.test?start=2030-06-01T02:00:00Z&end=2030-06-02T10:00:00Z'
    )
  );
  expect((await response.json()).data).toEqual({
    resources: [],
    reservations: [],
    start: '2030-06-01T00:00:00.000Z',
    end: '2030-06-02T00:00:00.000Z',
  });
  jest.clearAllMocks();
  const denied = await cabins(
    new Request(
      'https://admin.test?start=2030-06-01T02:00:00Z&end=2030-06-01T10:00:00Z'
    )
  );
  expect(await denied.json()).toEqual({
    success: false,
    error: 'End date must be after start date',
  });
  expect(connectDB).not.toHaveBeenCalled();
});
