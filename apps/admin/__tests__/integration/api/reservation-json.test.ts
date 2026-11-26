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
import {
  readReservationDetail,
  readReservationPayment,
  readReservationStatus,
} from '@/lib/validations/reservation-operations-json';
import {
  serializeDiningReservation,
  serializeExperienceReservation,
} from '@lodgeflow/database/reservation-json';
import { reservationPayment } from '@/lib/reservation-payment-route';
import { getClerkUser } from '@/lib/clerk-users';
import { requireApiAuth } from '@/lib/api-utils';
const mockRefundCreate = jest.fn();
const mockRefundRetrieve = jest.fn();
jest.mock(
  'stripe',
  () =>
    class {
      refunds = { create: mockRefundCreate, retrieve: mockRefundRetrieve };
    }
);
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
    const parsed = await readReservationDetail(response.clone(), f.kind);
    const envelope = await response.json();
    expect(parsed).toEqual(envelope.data);
    expect(envelope).toEqual({
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
    expect(
      (await readReservationDetail(missing, f.kind)).reservation
    ).toHaveProperty(f.kind, null);
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
    const parsedStatus = await readReservationStatus(changed.clone(), f.kind);
    expect(parsedStatus).toHaveProperty('status', 'confirmed');
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
    const parsedReceipt = await readReservationPayment(paid.clone(), {
      kind: f.kind,
      method: 'cash',
    });
    expect(parsedReceipt).toHaveProperty('receipts.0.reference', '');
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

test.each(['A1!', null])(
  'stored legacy fields survive detail and unpopulated read boundaries with currency %s',
  async currency => {
    await Settings.create({ currency });
    for (const f of await fixtures()) {
      const date = new Date('+010000-01-01T00:00:00.000Z');
      const receipt = {
        id: 'saved',
        type: 'payment',
        method: 'cash',
        amountCents: 100,
        reference: '',
        actor: 'staff',
        recordedAt: date,
      };
      await f.model.collection.updateOne(
        { _id: f.row._id },
        {
          $set: {
            checkout: null,
            stripeRefund: null,
            specialRequests: null,
            paymentConfirmationSentAt: null,
            isPaid: f.kind === 'dining',
            date,
            ...(f.kind === 'experience' ? { receipts: [receipt] } : {}),
          },
          ...(f.kind === 'dining' ? { $unset: { receipts: 1 } } : {}),
        }
      );
      const response = await reservationDetails({
        kind: f.kind,
        reservationId: String(f.row._id),
      });
      const envelope = await response.clone().json();
      const detail = await readReservationDetail(response, f.kind);
      expect(detail).toEqual(envelope.data);
      expect(detail.currency).toBe(currency);
      expect(detail.payment.legacyPaid).toBe(f.kind === 'dining');
      expect(detail.reservation).toMatchObject({
        checkout: null,
        stripeRefund: null,
        specialRequests: null,
        paymentConfirmationSentAt: null,
        date: date.toISOString(),
        id: String(f.row._id),
      });
      if (f.kind === 'dining') {
        const row = await DiningReservation.findById(f.row._id).lean().orFail();
        const data = serializeDiningReservation({
          reservation: row,
          dining: row.dining.toHexString(),
        });
        const parsed = await readReservationStatus(
          Response.json({ success: true, data }),
          f.kind
        );
        expect(parsed).toEqual(json(row));
        expect(parsed).not.toHaveProperty('receipts');
        expect(parsed).not.toHaveProperty('id');
      } else {
        const row = await ExperienceBooking.findById(f.row._id).lean().orFail();
        const data = serializeExperienceReservation({
          reservation: row,
          experience: row.experience.toHexString(),
        });
        const parsed = await readReservationStatus(
          Response.json({ success: true, data }),
          f.kind
        );
        expect(parsed).toEqual(json(row));
        expect(parsed).not.toHaveProperty('id');
        expect(parsed.receipts?.[0].reference).toBe('');
      }
    }
  }
);

test('detail retains additive data recursively and checks the amount units before rendering', async () => {
  const [f] = await fixtures();
  const hugeCents = Number.MAX_SAFE_INTEGER;
  f.row.receipts.push({
    id: 'original',
    type: 'payment',
    method: 'cash',
    amountCents: hugeCents,
    reference: '',
    actor: 'staff',
    recordedAt: new Date(),
  });
  await f.row.save();
  const response = await reservationDetails({
    kind: f.kind,
    reservationId: String(f.row._id),
  });
  const { data } = await response.json();
  const extra = { nested: [42, null] };
  const extended = {
    ...data,
    other: extra,
    reservation: {
      ...data.reservation,
      other: extra,
      dining: {
        ...data.reservation.dining,
        other: extra,
        servingTime: { ...data.reservation.dining.servingTime, other: extra },
      },
      receipts: [{ ...data.reservation.receipts[0], other: extra }],
    },
    payment: { ...data.payment, other: extra },
  };
  expect(
    await readReservationDetail(
      Response.json({ success: true, data: extended }),
      f.kind
    )
  ).toEqual(extended);
  expect(data.payment.paidCents).toBe(hugeCents);
  for (const amountCents of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    await expect(
      readReservationDetail(
        Response.json({
          success: true,
          data: {
            ...data,
            payment: { ...data.payment, paidCents: amountCents },
          },
        }),
        f.kind
      )
    ).rejects.toThrow('Unable to load reservation');
    await expect(
      readReservationDetail(
        Response.json({
          success: true,
          data: {
            ...data,
            reservation: {
              ...data.reservation,
              receipts: [{ ...data.reservation.receipts[0], amountCents }],
            },
          },
        }),
        f.kind
      )
    ).rejects.toThrow('Unable to load reservation');
  }
});

test('refund route returns the provider status and reconciles the same token on retry', async () => {
  const [f] = await fixtures();
  const token = '780b7330-b62d-4b6e-80cb-7c9f588ce19b';
  mockRefundCreate.mockResolvedValueOnce({ id: 're_test', status: null });
  mockRefundRetrieve.mockResolvedValueOnce({
    id: 're_test',
    status: 'succeeded',
  });
  f.row.stripePaymentIntentId = 'pi_fixture';
  f.row.receipts.push({
    id: 'paid',
    type: 'payment',
    method: 'stripe',
    amountCents: 100,
    actor: 'provider',
    reference: '',
    recordedAt: new Date(),
  });
  await f.row.save();
  for (const status of [null, 'succeeded', 'succeeded']) {
    const response = await reservationPayment(
      new Request('https://admin.test', {
        method: 'POST',
        body: JSON.stringify({
          id: token,
          type: 'refund',
          method: 'stripe',
          amountCents: 29,
          reference: 'Duplicate charge',
        }),
      }),
      { kind: f.kind, id: String(f.row._id) }
    );
    expect(response.status).toBe(200);
    expect(
      await readReservationPayment(response, { kind: f.kind, method: 'stripe' })
    ).toEqual({ status });
  }
  expect(mockRefundCreate).toHaveBeenCalledTimes(1);
  expect(mockRefundRetrieve).toHaveBeenCalledTimes(1);
  const saved = await DiningReservation.findById(f.row._id).orFail();
  expect(saved.receipts.filter(r => r.type === 'refund')).toEqual([
    expect.objectContaining({ id: token, amountCents: 29 }),
  ]);
});

test('unchanged status and duplicate receipt keep legacy stored amounts that detail cannot summarize', async () => {
  const [f] = await fixtures();
  const token = '780b7330-b62d-4b6e-80cb-7c9f588ce19b';
  const saved = {
    id: token,
    type: 'payment' as const,
    method: 'cash' as const,
    amountCents: 100,
    reference: '',
    actor: 'user_staff',
    recordedAt: new Date(),
  };
  f.row.receipts.push(saved, { ...saved, id: 'legacy', amountCents: 1.5 });
  await f.row.save();
  const reference = { kind: f.kind, reservationId: String(f.row._id) };
  const detail = await reservationDetails(reference);
  expect(detail.ok).toBe(false);
  const changed = await changeReservationStatus({
    ...reference,
    request: new Request('https://admin.test', {
      method: 'PATCH',
      body: JSON.stringify({ expectedStatus: 'pending', status: 'pending' }),
    }),
  });
  expect(changed.status).toBe(200);
  expect(await readReservationStatus(changed, f.kind)).toHaveProperty(
    'receipts.1.amountCents',
    1.5
  );
  const duplicate = await reservationPayment(
    new Request('https://admin.test', {
      method: 'POST',
      body: JSON.stringify({
        id: token,
        type: 'payment',
        method: 'cash',
        amountCents: 100,
        reference: '',
      }),
    }),
    { kind: f.kind, id: reference.reservationId }
  );
  expect(duplicate.status).toBe(200);
  expect(
    await readReservationPayment(duplicate, { kind: f.kind, method: 'cash' })
  ).toHaveProperty('receipts.1.amountCents', 1.5);
});

test('detail returns sparse stored refund metadata when the amount can be summarized', async () => {
  const [f] = await fixtures();
  await f.model.collection.updateOne(
    { _id: f.row._id },
    { $set: { stripeRefund: { amountCents: 29 } } }
  );
  const response = await reservationDetails({
    kind: f.kind,
    reservationId: String(f.row._id),
  });
  expect(response.status).toBe(200);
  expect(
    (await readReservationDetail(response, f.kind)).reservation.stripeRefund
  ).toEqual({ amountCents: 29 });
});
