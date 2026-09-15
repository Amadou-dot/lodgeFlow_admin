import {
  Booking,
  Cabin,
  Dining,
  DiningReservation,
  Experience,
  ExperienceBooking,
  AuditLog,
  transitionCapacityReservation,
  createDiningReservation,
  createExperienceReservation,
} from '@lodgeflow/database';
import { requireApiAuth } from '@/lib/api-utils';
import {
  reservationPipeline,
  cabinCalendar,
  capacityCalendar,
  calendarRange,
} from '@/lib/reservation-reads';
import { reservationLifecycle } from '@/lib/reservation-options';
import { GET as listReservations } from '@/app/api/reservations/route';
import { PATCH as patchDining } from '@/app/api/dining-reservations/[id]/route';
import { PATCH as patchExperience } from '@/app/api/experience-bookings/[id]/route';
import { GET as calendar } from '@/app/api/calendar/cabins/route';
jest.mock('@lodgeflow/database/mongodb', () =>
  jest.fn().mockResolvedValue(undefined)
);
const day = new Date('2030-06-01');
const req = (body: unknown) =>
  new Request('https://admin.test', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
const params = (id: string) => ({ params: Promise.resolve({ id }) });
async function fixtures() {
  const cabin = await Cabin.create({
    name: 'River cabin',
    description: 'Test',
    image: 'https://example.com/c.jpg',
    capacity: 4,
    price: 100,
  });
  const dining = await Dining.create({
    name: 'Dinner',
    description: 'Test',
    price: 25,
    image: 'https://example.com/d.jpg',
    type: 'menu',
    mealType: 'dinner',
    category: 'regular',
    servingTime: { start: '12:00', end: '22:00' },
    maxPeople: 4,
    minPeople: 1,
  });
  const experience = await Experience.create({
    name: 'Hike',
    ctaText: 'Book',
    description: 'Test',
    price: 30,
    duration: '2 hours',
    image: 'https://example.com/e.jpg',
    available: ['Monday'],
    difficulty: 'Easy',
    category: 'Outdoor',
    maxParticipants: 4,
  });
  return { cabin, dining, experience };
}
async function booking(
  cabin: unknown,
  checkInDate = new Date('2030-05-30'),
  checkOutDate = new Date('2030-06-03'),
  status = 'confirmed'
) {
  return Booking.create({
    cabin,
    customer: 'user_guest',
    checkInDate,
    checkOutDate,
    numGuests: 1,
    cabinPrice: 400,
    totalPrice: 400,
    status,
    payments: [],
  });
}
beforeEach(() => {
  process.env.LODGEFLOW_STAFF_ORG_ID = 'org_lodgeflow';
  (requireApiAuth as jest.Mock).mockResolvedValue({
    authenticated: true,
    userId: 'user_staff',
    role: 'front_desk',
  });
});
afterEach(() => {
  delete process.env.LODGEFLOW_STAFF_ORG_ID;
});
it('sorts and paginates the whole union once, preserving times and native statuses', async () => {
  const f = await fixtures();
  await booking(f.cabin._id, day, new Date('2030-06-03'), 'checked-in');
  await DiningReservation.create({
    dining: f.dining._id,
    customer: 'user_guest',
    date: day,
    time: '19:00',
    numGuests: 2,
    totalPrice: 50,
    status: 'no-show',
  });
  await ExperienceBooking.create({
    experience: f.experience._id,
    customer: 'user_guest',
    date: day,
    timeSlot: '09:00',
    numParticipants: 2,
    totalPrice: 60,
    status: 'confirmed',
  });
  const ids = [];
  for (let page = 1; page <= 3; page++) {
    const [result] = await Booking.aggregate(
      reservationPipeline(
        new URLSearchParams({ page: String(page), limit: '1' })
      ).pipeline
    );
    expect(result.total[0].count).toBe(3);
    expect(result.rows).toHaveLength(1);
    ids.push(result.rows[0].type);
    expect(result.rows[0].resourceName).toBeTruthy();
  }
  expect(ids).toEqual(['cabin', 'experience', 'dining']);
  const [filtered] = await Booking.aggregate(
    reservationPipeline(new URLSearchParams('type=dining&lifecycle=no_show'))
      .pipeline
  );
  expect(filtered.rows[0]).toMatchObject({
    time: '19:00',
    status: 'no-show',
    lifecycle: 'no_show',
    partySize: 2,
    resourceName: 'Dinner',
  });
  const response = await listReservations(
    new Request(
      'https://admin.test/api/reservations?resourceId=' + f.experience._id
    )
  );
  expect((await response?.json()).data.total).toBe(1);
  expect(
    (
      await listReservations(
        new Request('https://admin.test/api/reservations?type=unknown')
      )
    )?.status
  ).toBe(400);
});
it('applies date filters before pagination and resolves missing catalog references safely', async () => {
  const f = await fixtures();
  await booking(f.cabin._id, new Date('2030-05-31'), new Date('2030-06-02'));
  await booking(f.cabin._id, new Date('2030-06-10'), new Date('2030-06-12'));
  await Cabin.deleteOne({ _id: f.cabin._id });
  const [result] = await Booking.aggregate(
    reservationPipeline(new URLSearchParams('from=2030-06-01&to=2030-07-01'))
      .pipeline
  );
  expect(result.total[0].count).toBe(1);
  expect(result.rows[0].resourceName).toBe('Removed listing');
});
it('includes boundary-crossing cabin stays and excludes checkout-day/cancelled occupancy', async () => {
  const f = await fixtures();
  const crossing = await booking(f.cabin._id);
  const lastDay = await booking(
    f.cabin._id,
    new Date('2030-06-30'),
    new Date('2030-07-03')
  );
  await booking(f.cabin._id, new Date('2030-05-29'), day);
  await booking(f.cabin._id, new Date('2030-07-01'), new Date('2030-07-03'));
  await booking(
    f.cabin._id,
    new Date('2030-06-12'),
    new Date('2030-06-14'),
    'cancelled'
  );
  const result = await cabinCalendar(day, new Date('2030-07-01'));
  expect(result.reservations.map(item => String(item._id))).toEqual([
    crossing.id,
    lastDay.id,
  ]);
});
it('counts dining by seating time and experiences by UTC day, preserving uncapped listings', async () => {
  const f = await fixtures();
  await DiningReservation.create([
    {
      dining: f.dining._id,
      customer: 'a',
      date: day,
      time: '12:00',
      numGuests: 3,
      totalPrice: 75,
      status: 'confirmed',
    },
    {
      dining: f.dining._id,
      customer: 'b',
      date: new Date('2030-06-01T19:00:00Z'),
      time: '19:00',
      numGuests: 4,
      totalPrice: 100,
      status: 'pending',
    },
    {
      dining: f.dining._id,
      customer: 'c',
      date: day,
      time: '12:00',
      numGuests: 2,
      totalPrice: 50,
      status: 'no-show',
    },
  ]);
  const dining = await capacityCalendar('dining', day, new Date('2030-06-02'));
  expect(dining.resources[0]).toMatchObject({ isAvailable: true });
  expect(dining.usage.map(row => [row._id.time, row.used])).toEqual([
    ['12:00', 3],
    ['19:00', 4],
  ]);
  await Experience.findByIdAndUpdate(f.experience._id, {
    $unset: { maxParticipants: 1 },
  });
  await ExperienceBooking.create([
    {
      experience: f.experience._id,
      customer: 'a',
      date: day,
      timeSlot: 'Morning',
      numParticipants: 2,
      totalPrice: 60,
      status: 'confirmed',
    },
    {
      experience: f.experience._id,
      customer: 'b',
      date: new Date('2030-06-01T23:00:00Z'),
      timeSlot: 'Evening',
      numParticipants: 3,
      totalPrice: 90,
      status: 'pending',
    },
    {
      experience: f.experience._id,
      customer: 'c',
      date: day,
      numParticipants: 4,
      totalPrice: 120,
      status: 'cancelled',
    },
  ]);
  const experience = await capacityCalendar(
    'experience',
    day,
    new Date('2030-06-02')
  );
  expect(experience.usage[0].used).toBe(5);
  expect(experience.resources[0]).not.toHaveProperty('maxParticipants');
});
it('clamps calendar ranges and rejects invalid or reversed windows', async () => {
  const range = calendarRange(
    new URLSearchParams('start=2030-01-01&end=2032-01-01')
  );
  expect((range.end.getTime() - range.start.getTime()) / 86400000).toBe(180);
  expect(
    (await calendar(new Request('https://admin.test?start=bad&end=2030-02-01')))
      ?.status
  ).toBe(400);
  expect(
    (
      await calendar(
        new Request('https://admin.test?start=2030-02-01&end=2030-01-01')
      )
    )?.status
  ).toBe(400);
});
it('enforces native transitions, stale-state checks, strict payloads, and audit events', async () => {
  const f = await fixtures();
  const reservation = await createDiningReservation(
    String(f.dining._id),
    'user_guest',
    { date: day, time: '19:00', numGuests: 2 }
  );
  const id = String(reservation!._id);
  expect(
    (
      await patchDining(
        req({ expectedStatus: 'pending', status: 'confirmed' }),
        params(id)
      )
    )?.status
  ).toBe(200);
  expect(
    (
      await patchDining(
        req({ expectedStatus: 'pending', status: 'cancelled' }),
        params(id)
      )
    )?.status
  ).toBe(409);
  expect(
    (
      await patchDining(
        req({
          expectedStatus: 'confirmed',
          status: 'completed',
          totalPrice: 0,
        }),
        params(id)
      )
    )?.status
  ).toBe(400);
  expect(
    (
      await patchDining(
        req({ expectedStatus: 'confirmed', status: 'no-show' }),
        params(id)
      )
    )?.status
  ).toBe(200);
  expect(
    (
      await patchDining(
        req({ expectedStatus: 'no-show', status: 'confirmed' }),
        params(id)
      )
    )?.status
  ).toBe(400);
  const events = await AuditLog.find({ resourceId: id })
    .sort({ createdAt: 1 })
    .lean();
  expect(events.map(event => event.after.status)).toEqual([
    'confirmed',
    'no-show',
  ]);
  const exp = await createExperienceReservation(
    String(f.experience._id),
    'user_guest',
    { date: day, numParticipants: 2 }
  );
  expect(
    (
      await patchExperience(
        req({ expectedStatus: 'pending', status: 'no-show' }),
        params(String(exp!._id))
      )
    )?.status
  ).toBe(400);
});
it('releases capacity with the shared transaction and rejects competing stale status edits', async () => {
  const f = await fixtures();
  const reservation = await createDiningReservation(String(f.dining._id), 'a', {
    date: day,
    time: '19:00',
    numGuests: 4,
  });
  const id = String(reservation!._id);
  const results = await Promise.allSettled([
    transitionCapacityReservation('dining', id, 'pending', 'confirmed'),
    transitionCapacityReservation('dining', id, 'pending', 'cancelled'),
  ]);
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(
    1
  );
  const current = await DiningReservation.findById(id);
  if (current.status === 'confirmed')
    await transitionCapacityReservation('dining', id, 'confirmed', 'no-show');
  await expect(
    createDiningReservation(String(f.dining._id), 'b', {
      date: day,
      time: '19:00',
      numGuests: 4,
    })
  ).resolves.toBeTruthy();
});
it('blocks paid dining and experience cancellations without recording false refunds', async () => {
  const f = await fixtures();
  const dining = await DiningReservation.create({
    dining: f.dining._id,
    customer: 'a',
    date: day,
    time: '19:00',
    numGuests: 1,
    totalPrice: 25,
    status: 'confirmed',
    isPaid: true,
  });
  const exp = await ExperienceBooking.create({
    experience: f.experience._id,
    customer: 'a',
    date: day,
    numParticipants: 1,
    totalPrice: 30,
    status: 'confirmed',
    isPaid: true,
  });
  await expect(
    transitionCapacityReservation('dining', dining.id, 'confirmed', 'cancelled')
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    transitionCapacityReservation(
      'experience',
      exp.id,
      'confirmed',
      'cancelled'
    )
  ).rejects.toMatchObject({ status: 409 });
  expect(await AuditLog.countDocuments()).toBe(0);
});
it('maps lifecycle labels without losing native statuses', () => {
  expect(
    [
      'unconfirmed',
      'checked-in',
      'checked-out',
      'no-show',
      'pending',
      'confirmed',
      'cancelled',
    ].map(reservationLifecycle)
  ).toEqual([
    'pending',
    'active',
    'completed',
    'no_show',
    'pending',
    'confirmed',
    'cancelled',
  ]);
});
