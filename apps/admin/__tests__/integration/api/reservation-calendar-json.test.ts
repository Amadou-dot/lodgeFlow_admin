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
import {
  readCalendarResponse,
  readReservationInboxResponse,
} from '@/lib/validations/reservation-calendar-json';
import type { CalendarKind } from '@/types/reservation-calendar';
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
  expect(
    await readCalendarResponse({ response: response.clone(), kind: 'cabins' })
  ).toEqual(json(expected));
  expect(await response.json()).toEqual({
    success: true,
    data: json(expected),
  });
});
test('capacity calendars preserve seating/day grouping, sparse capacity and selected fields', async () => {
  const f = await fixtures();
  const dining = await diningCalendar(request());
  const diningBody = await dining.clone().json();
  expect(
    await readCalendarResponse({ response: dining, kind: 'dining' })
  ).toEqual(diningBody.data);
  expect(diningBody).toEqual({
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
  const experienceBody = await experience.clone().json();
  expect(
    await readCalendarResponse({ response: experience, kind: 'experiences' })
  ).toEqual(experienceBody.data);
  expect(experienceBody).toEqual({
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
  const body = await response.clone().json();
  expect(await readReservationInboxResponse(response)).toEqual(body.data);
  expect(body).toEqual({
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
  const expected = { rows: [], total: 0, page: 1, limit: 25 };
  expect(await readReservationInboxResponse(response.clone())).toEqual(
    expected
  );
  expect(await response.json()).toEqual({
    success: true,
    data: expected,
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
  const expected = {
    resources: [],
    reservations: [],
    start: '2030-06-01T00:00:00.000Z',
    end: '2030-06-02T00:00:00.000Z',
  };
  expect(await response.clone().json()).toEqual({
    success: true,
    data: expected,
  });
  expect(await readCalendarResponse({ response, kind: 'cabins' })).toEqual(
    expected
  );
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

test('inbox and cabin calendar retain null and omitted stored booking and listing states', async () => {
  const { cabin } = await fixtures();
  const sparse = await Cabin.create({
    name: 'Sparse cabin',
    description: 'Legacy listing',
    image: 'https://example.invalid/sparse.jpg',
    price: 75,
    capacity: 2,
    status: null,
  });
  const legacyBooking = await Booking.create({
    cabin: sparse._id,
    customer: 'missing_guest',
    checkInDate: new Date('2030-06-02'),
    checkOutDate: new Date('2030-06-03'),
    numGuests: 1,
    cabinPrice: 75,
    totalPrice: 75,
    status: null,
  });
  await Cabin.collection.updateOne(
    { _id: cabin._id },
    { $unset: { status: '' } }
  );
  await Booking.collection.updateOne(
    { cabin: cabin._id },
    { $unset: { status: '', isPaid: '' } }
  );
  // Booking saves currently recompute isPaid. Retain coverage for stored legacy flags.
  await Booking.collection.updateOne(
    { _id: legacyBooking._id },
    { $set: { isPaid: null } }
  );

  const calendar = await cabins(request());
  const calendarBody = await calendar.clone().json();
  expect(
    await readCalendarResponse({ response: calendar, kind: 'cabins' })
  ).toEqual(calendarBody.data);
  expect(calendarBody.data.resources).toEqual([
    { _id: String(cabin._id), name: 'Cabin' },
    { _id: String(sparse._id), name: 'Sparse cabin', status: null },
  ]);
  expect(calendarBody.data.reservations[0]).not.toHaveProperty('status');
  expect(calendarBody.data.reservations[1]).toMatchObject({
    _id: String(legacyBooking._id),
    status: null,
  });

  const response = await inbox(
    new Request('https://admin.test/api/reservations?type=cabin')
  );
  const body = await response.clone().json();
  const data = await readReservationInboxResponse(response);
  expect(data).toEqual(body.data);
  expect(data.rows[0]).not.toHaveProperty('status');
  expect(data.rows[0]).not.toHaveProperty('lifecycle');
  expect(data.rows[0]).not.toHaveProperty('isPaid');
  expect(data.rows[1]).toMatchObject({
    _id: String(legacyBooking._id),
    status: null,
    lifecycle: null,
    isPaid: null,
    time: null,
    endDate: '2030-06-03T00:00:00.000Z',
  });
});

test('capacity calendars retain sparse and nullable metadata, legacy values, and orphaned usage', async () => {
  const f = await fixtures();
  // Lean projections do not fill defaults or require all fields of older catalogs.
  await Dining.collection.updateOne(
    { _id: f.dining._id },
    {
      $set: {
        servingTime: { start: 'open', end: null },
        isAvailable: null,
        maxPeople: 3.5,
      },
    }
  );
  await Experience.collection.updateOne(
    { _id: f.experience._id },
    { $set: { maxParticipants: null } }
  );
  const removedDining = new Types.ObjectId();
  await DiningReservation.create({
    dining: removedDining,
    customer: 'missing_guest',
    date: new Date('2030-06-01T23:59:00Z'),
    time: '21:00',
    numGuests: 2,
    totalPrice: 0,
  });

  const dining = await diningCalendar(request());
  const diningBody = await dining.clone().json();
  expect(
    await readCalendarResponse({ response: dining, kind: 'dining' })
  ).toEqual(diningBody.data);
  expect(diningBody.data.resources).toEqual([
    {
      _id: String(f.dining._id),
      name: 'Dinner',
      servingTime: { start: 'open', end: null },
      isAvailable: null,
      maxPeople: 3.5,
    },
  ]);
  expect(diningBody.data.usage).toContainEqual({
    _id: {
      resourceId: String(removedDining),
      date: '2030-06-01',
      time: '21:00',
    },
    used: 2,
  });
  const experience = await experiences(request());
  const experienceBody = await experience.clone().json();
  expect(
    await readCalendarResponse({ response: experience, kind: 'experiences' })
  ).toEqual(experienceBody.data);
  expect(experienceBody.data.resources).toEqual([
    { _id: String(f.experience._id), name: 'Walk', maxParticipants: null },
  ]);
});

test('inbox retains signed timestamps and response pagination beyond request limits', async () => {
  const { cabin } = await fixtures();
  const legacyDate = new Date('+010000-06-01T00:00:00.000Z');
  await Booking.create({
    cabin: cabin._id,
    customer: 'missing_guest',
    checkInDate: legacyDate,
    checkOutDate: new Date('+010000-06-02T00:00:00.000Z'),
    numGuests: 1,
    cabinPrice: 90,
    totalPrice: 90,
    createdAt: legacyDate,
  });
  const response = await inbox(
    new Request(
      'https://admin.test/api/reservations?from=%2B010000-06-01&type=cabin'
    )
  );
  const data = await readReservationInboxResponse(response);
  expect(data.rows[0]).toMatchObject({
    date: legacyDate.toISOString(),
    createdAt: legacyDate.toISOString(),
  });

  const expanded = {
    ...data,
    page: 10001,
    limit: 101,
    metadata: { order: ['cabin'] },
    rows: data.rows.map(row => ({ ...row, metadata: { source: 'legacy' } })),
  };
  expect(
    await readReservationInboxResponse(
      Response.json({ success: true, data: expanded })
    )
  ).toStrictEqual(expanded);
});

test.each([
  ['cabins', cabins],
  ['dining', diningCalendar],
  ['experiences', experiences],
] as const)(
  'calendar %s accepts an empty route result',
  async (kind, route) => {
    const response = await route(request());
    const expected = {
      start: start.toISOString(),
      end: end.toISOString(),
      resources: [],
      ...(kind === 'cabins' ? { reservations: [] } : { usage: [] }),
    };
    expect(
      await readCalendarResponse({ response: response.clone(), kind })
    ).toEqual(expected);
    expect(await response.json()).toEqual({ success: true, data: expected });
  }
);

test('capacity response parsing preserves additive fields within resources and usage keys', async () => {
  const f = await fixtures();
  const response = await diningCalendar(request());
  const body = await readCalendarResponse({ response, kind: 'dining' });
  const expanded = {
    ...body,
    resources: [
      {
        _id: String(f.dining._id),
        name: 'Dinner',
        servingTime: {
          start: '12:00',
          end: '22:00',
          service: { type: 'dinner' },
        },
        metadata: { floor: 1 },
      },
    ],
    usage: [
      {
        _id: {
          resourceId: String(f.dining._id),
          date: '2030-06-01',
          time: '19:00',
          source: { table: 6 },
        },
        used: 0,
        note: null,
      },
    ],
    calendarVersion: 2,
  };
  expect(
    await readCalendarResponse({
      response: Response.json({ success: true, data: expanded }),
      kind: 'dining',
    })
  ).toStrictEqual(expanded);
});

test.each([
  [
    'invalid day',
    'dining',
    {
      usage: [
        {
          _id: {
            resourceId: '507f1f77bcf86cd799439012',
            date: '2030-02-30',
            time: '19:00',
          },
          used: 2,
        },
      ],
    },
  ],
  [
    'invalid stay status',
    'cabins',
    {
      reservations: [
        {
          _id: '507f1f77bcf86cd799439011',
          cabin: '507f1f77bcf86cd799439012',
          customer: 'missing_guest',
          checkInDate: '2030-06-01T00:00:00.000Z',
          checkOutDate: '2030-06-02T00:00:00.000Z',
          status: 'seated',
        },
      ],
    },
  ],
  ['reversed range', 'experiences', { end: '2030-05-01T00:00:00.000Z' }],
] satisfies [string, CalendarKind, object][])(
  'calendar rejects %s',
  async (_case, kind, fields) => {
    await expect(
      readCalendarResponse({
        response: Response.json({
          success: true,
          data: {
            start: start.toISOString(),
            end: end.toISOString(),
            resources: [],
            ...(kind === 'cabins' ? { reservations: [] } : { usage: [] }),
            ...fields,
          },
        }),
        kind,
      })
    ).rejects.toThrow('Unable to load calendar');
  }
);

test('inbox retains the null end-date fallback for a sparse cabin row', async () => {
  const { cabin } = await fixtures();
  await Booking.collection.updateOne(
    { cabin: cabin._id },
    { $unset: { checkOutDate: '' } }
  );
  const response = await inbox(
    new Request('https://admin.test/api/reservations?type=cabin')
  );
  expect(await response.clone().json()).toMatchObject({
    success: true,
    data: { rows: [{ type: 'cabin', endDate: null, time: null }] },
  });
  expect(await readReservationInboxResponse(response)).toMatchObject({
    rows: [{ type: 'cabin', endDate: null, time: null }],
  });
});

test('inbox route and reader preserve finite stored prices beyond the safe cents range', async () => {
  const { dining } = await fixtures();
  const totalPrice = Number.MAX_SAFE_INTEGER;
  const reservation = await DiningReservation.create({
    dining: dining._id,
    customer: 'missing_guest',
    date: start,
    time: '21:00',
    numGuests: 2,
    totalPrice,
  });
  const response = await inbox(
    new Request('https://admin.test/api/reservations?type=dining')
  );
  const body = await response.clone().json();
  const data = await readReservationInboxResponse(response);
  expect(data).toEqual(body.data);
  expect(data.rows.map(row => row.totalPrice)).toEqual([40, totalPrice]);
  expect(data.rows[1]._id).toBe(String(reservation._id));
});
