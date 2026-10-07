import {
  Dining,
  DiningReservation,
  Experience,
  ExperienceBooking,
  Settings,
} from '@lodgeflow/database';
import {
  reservationDetails,
  changeReservationStatus,
} from '@/lib/reservation-status-route';
import { reservationPayment } from '@/lib/reservation-payment-route';
import { getClerkUser } from '@/lib/clerk-users';
import { requireApiAuth } from '@/lib/api-utils';
jest.mock('@lodgeflow/database/mongodb', () =>
  jest.fn().mockResolvedValue(undefined)
);
function json(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}
beforeEach(() => {
  jest.mocked(getClerkUser).mockRejectedValue(new Error('Unavailable guest'));
  jest.mocked(requireApiAuth).mockResolvedValue({
    authenticated: true,
    userId: 'user_staff',
    role: 'manager',
  });
});
async function fixtures() {
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
  const date = new Date('2030-06-01');
  return [
    {
      kind: 'dining' as const,
      model: DiningReservation,
      listing: Dining,
      row: await DiningReservation.create({
        dining: dining._id,
        customer: 'missing_guest',
        date,
        time: '19:00',
        numGuests: 2,
        totalPrice: 40,
      }),
    },
    {
      kind: 'experience' as const,
      model: ExperienceBooking,
      listing: Experience,
      row: await ExperienceBooking.create({
        experience: experience._id,
        customer: 'missing_guest',
        date,
        numParticipants: 2,
        totalPrice: 60,
      }),
    },
  ];
}
test('staff detail preserves populated documents, receipt/checkout dates, summaries and missing references', async () => {
  const currency = (await Settings.getSettings()).currency;
  for (const f of await fixtures()) {
    f.row.receipts = [
      {
        id: 'paid',
        type: 'payment',
        amountCents: 100,
        method: 'cash',
        reference: '',
        actor: 'staff',
        recordedAt: new Date('2029-12-01'),
      },
    ];
    f.row.checkout = {
      token: 'token',
      amountCents: 100,
      currency: 'usd',
      createdAt: new Date('2029-12-02'),
      pending: false,
    };
    await f.row.save();
    const reference = { kind: f.kind, reservationId: String(f.row._id) };
    const response = await reservationDetails(reference);
    const stored =
      f.kind === 'dining'
        ? await f.model.findById(f.row._id).populate('dining')
        : await f.model.findById(f.row._id).populate('experience');
    expect(await response.json()).toEqual({
      success: true,
      data: {
        reservation: json(stored),
        payment: {
          totalCents: f.row.totalPrice * 100,
          paidCents: 100,
          refundedCents: 0,
          balanceCents: f.row.totalPrice * 100 - 100,
          refundableCents: 100,
          legacyPaid: false,
        },
        currency,
        customerName: 'Unavailable guest',
        allowedStatuses: ['confirmed', 'cancelled'],
      },
    });
    await f.listing.deleteMany({});
    const missing = await reservationDetails(reference);
    expect((await missing.json()).data.reservation[f.kind]).toBeNull();
  }
});
test('staff status and receipt mutations retain unpopulated JSON and virtual IDs', async () => {
  for (const f of await fixtures()) {
    const reservationId = String(f.row._id);
    const changed = await changeReservationStatus({
      kind: f.kind,
      reservationId,
      request: new Request('https://admin.test', {
        method: 'PATCH',
        body: JSON.stringify({
          expectedStatus: 'pending',
          status: 'confirmed',
        }),
      }),
    });
    expect(await changed.json()).toEqual({
      success: true,
      data: json(
        f.kind === 'dining'
          ? await f.model.findById(reservationId)
          : await f.model.findById(reservationId)
      ),
    });
    const paid = await reservationPayment(
      new Request('https://admin.test', {
        method: 'POST',
        body: JSON.stringify({
          id: '780b7330-b62d-4b6e-80cb-7c9f588ce19b',
          type: 'payment',
          amountCents: 100,
          method: 'cash',
          reference: '',
        }),
      }),
      { kind: f.kind, id: reservationId }
    );
    expect(await paid.json()).toEqual({
      success: true,
      data: json(
        f.kind === 'dining'
          ? await f.model.findById(reservationId)
          : await f.model.findById(reservationId)
      ),
    });
  }
});

test('manual receipt failures are safely logged', async () => {
  const { default: connectDB } = await import('@/lib/mongodb');
  const { logger } = await import('@/lib/logger');
  const failure = new Error('private database detail');
  jest.mocked(connectDB).mockRejectedValueOnce(failure);
  const log = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
  try {
    const response = await reservationPayment(
      new Request('https://admin.test', {
        method: 'POST',
        body: JSON.stringify({
          id: '780b7330-b62d-4b6e-80cb-7c9f588ce19b',
          type: 'payment',
          amountCents: 100,
          method: 'cash',
          reference: '',
        }),
      }),
      { kind: 'dining', id: '507f1f77bcf86cd7994390ab' }
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Unable to record transaction',
    });
    expect(log).toHaveBeenCalledWith('Unable to record transaction', failure);
  } finally {
    log.mockRestore();
  }
});

test('manual receipts reject prototype keys before connecting', async () => {
  const { default: connectDB } = await import('@/lib/mongodb');
  jest.mocked(connectDB).mockClear();
  const response = await reservationPayment(
    new Request('https://admin.test', {
      method: 'POST',
      body: '{"id":"780b7330-b62d-4b6e-80cb-7c9f588ce19b","type":"payment","amountCents":100,"method":"cash","reference":"","__proto__":{}}',
    }),
    { kind: 'dining', id: '507f1f77bcf86cd7994390ab' }
  );
  expect(response.status).toBe(400);
  expect(connectDB).not.toHaveBeenCalled();
});
