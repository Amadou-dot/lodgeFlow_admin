import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  AuditLog,
  Dining,
  DiningReservation,
  Experience,
  ExperienceBooking,
  type ReservationPaymentState,
} from '@lodgeflow/database';
import { createErrorResponse, requireApiAuth } from '@/lib/api-utils';
import connectDB from '@/lib/mongodb';
import {
  GET as getDining,
  PATCH as patchDining,
} from '@/app/api/dining-reservations/[id]/route';
import {
  GET as getExperience,
  PATCH as patchExperience,
} from '@/app/api/experience-bookings/[id]/route';

jest.mock('@/lib/mongodb', () => jest.fn().mockResolvedValue(undefined));

const date = new Date('2030-06-01T18:00:00Z');
type ProtectedState = Partial<
  Pick<ReservationPaymentState, 'receipts' | 'checkout' | 'stripeRefund'>
> & { isPaid?: boolean };
const resources = [
  {
    kind: 'dining',
    get: getDining,
    patch: patchDining,
    model: DiningReservation,
    read: (id: string) => DiningReservation.findById(id),
    catalog: Dining,
    async create(state: ProtectedState = {}) {
      const listing = await Dining.create({
        name: 'Dinner',
        description: 'Status operation fixture',
        price: 25,
        image: 'https://example.invalid/dinner.jpg',
        type: 'menu',
        mealType: 'dinner',
        category: 'regular',
        servingTime: { start: '17:00', end: '22:00' },
        minPeople: 1,
        maxPeople: 4,
      });
      return DiningReservation.create({
        dining: listing._id,
        customer: 'owner',
        date,
        time: '18:00',
        numGuests: 2,
        totalPrice: 50,
        ...state,
      });
    },
  },
  {
    kind: 'experience',
    get: getExperience,
    patch: patchExperience,
    model: ExperienceBooking,
    read: (id: string) => ExperienceBooking.findById(id),
    catalog: Experience,
    async create(state: ProtectedState = {}) {
      const listing = await Experience.create({
        name: 'Hike',
        description: 'Status operation fixture',
        price: 25,
        image: 'https://example.invalid/hike.jpg',
        duration: '2 hours',
        difficulty: 'Easy',
        category: 'Outdoor',
        available: ['Monday'],
        includes: [],
        ctaText: 'Book now',
        maxParticipants: 4,
      });
      return ExperienceBooking.create({
        experience: listing._id,
        customer: 'owner',
        date,
        timeSlot: '18:00',
        numParticipants: 2,
        totalPrice: 50,
        ...state,
      });
    },
  },
] as const;
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const request = (body: unknown) =>
  new Request('https://admin.test', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
async function snapshot() {
  return JSON.stringify(
    await Promise.all([
      Dining.find().select('+reservationVersion').sort({ _id: 1 }).lean(),
      Experience.find().select('+reservationVersion').sort({ _id: 1 }).lean(),
      DiningReservation.find().sort({ _id: 1 }).lean(),
      ExperienceBooking.find().sort({ _id: 1 }).lean(),
      AuditLog.find().sort({ _id: 1 }).lean(),
    ])
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  process.env.LODGEFLOW_STAFF_ORG_ID = 'status_org';
  jest.mocked(requireApiAuth).mockResolvedValue({
    authenticated: true,
    userId: 'status_staff',
    role: 'front_desk',
  });
});
afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.LODGEFLOW_STAFF_ORG_ID;
});

for (const resource of resources) {
  describe(`${resource.kind} staff status boundary`, () => {
    it('maps invalid persisted receipt cents into a reservation error without writes', async () => {
      const row = await resource.create({
        receipts: [
          {
            id: 'unsafe-receipt',
            type: 'payment',
            amountCents: 1.5,
            method: 'cash',
            actor: 'staff',
            reference: '',
            recordedAt: date,
          },
        ],
      });
      const before = await snapshot();
      const response = await resource.get(request({}), params(String(row._id)));
      assert.ok(response);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        success: false,
        error: 'Cents must be a safe integer',
      });
      expect(await snapshot()).toBe(before);
    });

    it('authorizes before reading the body or validating IDs', async () => {
      const row = await resource.create();
      const before = await snapshot();
      jest.mocked(requireApiAuth).mockResolvedValue({
        authenticated: false,
        error: createErrorResponse('Forbidden', 403),
      });
      const input = new Request('https://admin.test', {
        method: 'PATCH',
        body: '{',
      });
      const response = await resource.patch(input, params('invalid'));
      assert.ok(response);
      expect(response.status).toBe(403);
      expect(input.bodyUsed).toBe(false);
      const detail = await resource.get(request({}), params(String(row._id)));
      assert.ok(detail);
      expect(detail.status).toBe(403);
      expect(requireApiAuth).toHaveBeenNthCalledWith(1, {
        permission: 'bookings:manage',
      });
      expect(requireApiAuth).toHaveBeenNthCalledWith(2, {
        permission: 'bookings:read',
      });
      expect(connectDB).not.toHaveBeenCalled();
      expect(await snapshot()).toBe(before);
    });

    it('rejects malformed JSON and non-string, missing or extra fields before database access', async () => {
      const row = await resource.create();
      const before = await snapshot();
      const malformed = await resource.patch(
        new Request('https://admin.test', { method: 'PATCH', body: '{' }),
        params(String(row._id))
      );
      assert.ok(malformed);
      expect(malformed.status).toBe(400);
      expect(await malformed.json()).toEqual({
        success: false,
        error: 'Invalid JSON',
      });
      const prototypeKeyBody: unknown = JSON.parse(
        '{"expectedStatus":"pending","status":"confirmed","__proto__":{}}'
      );
      for (const body of [
        null,
        [],
        true,
        1,
        'pending',
        {},
        { status: 'confirmed' },
        { expectedStatus: 'pending' },
        { expectedStatus: 1, status: 'confirmed' },
        { expectedStatus: 'pending', status: null },
        { expectedStatus: 'pending', status: 'confirmed', totalPrice: 0 },
        {
          expectedStatus: 'pending',
          status: 'confirmed',
          $set: { totalPrice: 0 },
        },
        {
          expectedStatus: 'pending',
          status: 'confirmed',
          'status.next': 'cancelled',
        },
        prototypeKeyBody,
      ]) {
        const response = await resource.patch(
          request(body),
          params(String(row._id))
        );
        assert.ok(response);
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({
          success: false,
          error: 'Only status and expectedStatus are accepted',
        });
      }
      expect(connectDB).not.toHaveBeenCalled();
      expect(await snapshot()).toBe(before);
    });

    it('preserves missing, stale and invalid-transition precedence with no writes', async () => {
      const row = await resource.create();
      const before = await snapshot();
      for (const attempt of [
        {
          id: 'invalid',
          expectedStatus: 'unknown',
          status: 'unknown',
          code: 404,
          error: 'Reservation or listing not found',
        },
        {
          id: String(new mongoose.Types.ObjectId()),
          expectedStatus: 'unknown',
          status: 'unknown',
          code: 404,
          error: 'Reservation not found',
        },
        {
          id: String(row._id),
          expectedStatus: 'unknown',
          status: 'unknown',
          code: 409,
          error: 'Reservation changed; refresh and try again',
        },
        {
          id: String(row._id),
          expectedStatus: '',
          status: '',
          code: 409,
          error: 'Reservation changed; refresh and try again',
        },
        {
          id: String(row._id),
          expectedStatus: 'pending',
          status: 'unknown',
          code: 400,
          error: 'Invalid reservation status transition',
        },
        {
          id: String(row._id),
          expectedStatus: 'pending',
          status: '',
          code: 400,
          error: 'Invalid reservation status transition',
        },
      ]) {
        const response = await resource.patch(
          request({
            expectedStatus: attempt.expectedStatus,
            status: attempt.status,
          }),
          params(attempt.id)
        );
        assert.ok(response);
        expect(response.status).toBe(attempt.code);
        expect(await response.json()).toEqual({
          success: false,
          error: attempt.error,
        });
        expect(await snapshot()).toBe(before);
      }
    });

    it('changes only status, attributes one audit and does not repeat it for a no-op', async () => {
      const row = await resource.create();
      const id = String(row._id);
      const input = { expectedStatus: 'pending', status: 'confirmed' };
      const response = await resource.patch(request(input), params(id));
      assert.ok(response);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        success: true,
        data: JSON.parse(JSON.stringify(await resource.read(id))),
      });
      const stored = await resource.read(id).lean();
      expect(stored).toMatchObject({
        status: 'confirmed',
        customer: 'owner',
        totalPrice: 50,
        receipts: [],
        date,
      });
      const audits = await AuditLog.find({ resourceId: id }).lean();
      expect(audits).toHaveLength(1);
      expect(audits[0]).toMatchObject({
        actor: 'status_staff',
        actorRole: 'front_desk',
        organizationId: 'status_org',
        action:
          resource.kind === 'dining'
            ? 'dining_reservation.status_change'
            : 'experience_booking.status_change',
        resourceType:
          resource.kind === 'dining'
            ? 'dining_reservation'
            : 'experience_booking',
        before: { status: 'pending' },
        after: { status: 'confirmed' },
      });
      const repeated = await resource.patch(
        request({ expectedStatus: 'confirmed', status: 'confirmed' }),
        params(id)
      );
      assert.ok(repeated);
      expect(repeated.status).toBe(200);
      expect(await resource.read(id).lean()).toEqual(stored);
      expect(await AuditLog.find({ resourceId: id }).lean()).toEqual(audits);
      const listing = await resource.catalog
        .findById(row.get(resource.kind))
        .select('+reservationVersion')
        .lean();
      expect(listing).toMatchObject({ reservationVersion: 2 });
    });

    it('retains no-op, payment and pending-transaction guard ordering', async () => {
      const checkout = {
        token: 'pending',
        amountCents: 5000,
        currency: 'usd',
        createdAt: date,
        pending: true,
      };
      for (const state of [
        { isPaid: true, checkout },
        { checkout },
        {
          stripeRefund: {
            token: 'refund',
            amountCents: 5000,
            createdAt: date,
            status: 'pending',
            actor: 'staff',
            reference: 'Refund',
          },
        },
      ] satisfies ProtectedState[]) {
        const row = await resource.create(state);
        const id = String(row._id);
        const before = await snapshot();
        const denied = await resource.patch(
          request({ expectedStatus: 'pending', status: 'cancelled' }),
          params(id)
        );
        assert.ok(denied);
        expect(denied.status).toBe(409);
        expect(await denied.json()).toEqual({
          success: false,
          error:
            'isPaid' in state
              ? 'Paid reservations require refund reconciliation before cancellation'
              : 'An online transaction is pending',
        });
        expect(await snapshot()).toBe(before);
        const beforeRow = await resource.read(id).lean();
        const unchanged = await resource.patch(
          request({ expectedStatus: 'pending', status: 'pending' }),
          params(id)
        );
        assert.ok(unchanged);
        expect(unchanged.status).toBe(200);
        expect(await resource.read(id).lean()).toEqual(beforeRow);
        expect(await AuditLog.countDocuments()).toBe(0);
      }
    });

    it('allows only one competing status edit and records only the committed transition', async () => {
      const row = await resource.create();
      const id = String(row._id);
      const responses = await Promise.all(
        ['confirmed', 'cancelled'].map(status =>
          resource.patch(
            request({ expectedStatus: 'pending', status }),
            params(id)
          )
        )
      );
      expect(responses.map(response => response?.status).sort()).toEqual([
        200, 409,
      ]);
      const saved = await resource.read(id).lean();
      assert.ok(saved && !Array.isArray(saved));
      const audits = await AuditLog.find({ resourceId: id }).lean();
      expect(audits).toHaveLength(1);
      expect(audits[0].after).toEqual({ status: saved.status });
      expect(audits[0].before).toEqual({ status: 'pending' });
      expect(saved.totalPrice).toBe(50);
      expect(saved.receipts).toEqual([]);
    });

    it('returns existing detail fields and safe database failure envelopes', async () => {
      const row = await resource.create();
      const id = String(row._id);
      const response = await resource.get(request({}), params(id));
      assert.ok(response);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.customerName).toBe('Test User');
      expect(body.data.allowedStatuses).toEqual(['confirmed', 'cancelled']);
      expect(body.data.reservation[resource.kind].name).toBe(
        resource.kind === 'dining' ? 'Dinner' : 'Hike'
      );
      const before = await snapshot();
      jest
        .mocked(connectDB)
        .mockRejectedValueOnce(new Error('Private database failure'));
      const failedRead = await resource.get(request({}), params(id));
      assert.ok(failedRead);
      expect(failedRead.status).toBe(500);
      expect(await failedRead.json()).toEqual({
        success: false,
        error: 'Unable to load reservation',
      });
      jest
        .mocked(connectDB)
        .mockRejectedValueOnce(new Error('Private database failure'));
      const failedWrite = await resource.patch(
        request({ expectedStatus: 'pending', status: 'confirmed' }),
        params(id)
      );
      assert.ok(failedWrite);
      expect(failedWrite.status).toBe(500);
      expect(await failedWrite.json()).toEqual({
        success: false,
        error: 'Unable to change reservation status',
      });
      expect(await snapshot()).toBe(before);
    });
  });
}
