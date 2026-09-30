import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import type { z } from 'zod';
import type { updateBookingSchema } from '@/lib/validations/booking';
import { Booking, Cabin, AuditLog } from '@lodgeflow/database';

jest.mock('@lodgeflow/database/mongodb', () =>
  jest.fn().mockResolvedValue(undefined)
);
import { PUT } from '@/app/api/bookings/route';
import { PATCH } from '@/app/api/bookings/[id]/route';

const cancelledAt = '2030-06-01T12:00:00.000Z';
const refundedAt = '2030-06-02T12:00:00.000Z';
const fields = {
  cancellationReason: '',
  refundStatus: 'none',
  refundAmount: 0,
  refundedAt,
  cancelledAt,
} satisfies Omit<z.input<typeof updateBookingSchema>, '_id'>;
const profiles = [
  {
    method: 'PUT',
    order:
      'refundStatus, refundAmount, refundedAt, cancellationReason, cancelledAt',
    async change({ id, body }: { id: string; body: object }) {
      return PUT(
        new NextRequest('http://localhost/api/bookings', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ _id: id, ...body }),
        })
      );
    },
  },
  {
    method: 'PATCH',
    order: 'cancellationReason, refundStatus, refundAmount, refundedAt',
    async change({ id, body }: { id: string; body: object }) {
      return PATCH(
        new Request(`http://localhost/api/bookings/${id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }),
        { params: Promise.resolve({ id }) }
      );
    },
  },
] as const;
async function fixture(status: 'unconfirmed' | 'cancelled') {
  const cabin = await Cabin.create({
    name: 'Cancellation fixture',
    description: 'Isolated metadata guard fixture',
    price: 200,
    capacity: 4,
    image: 'https://example.invalid/cabin.jpg',
  });
  return Booking.create({
    cabin: cabin._id,
    customer: 'user_test123',
    status,
    checkInDate: new Date('2030-06-10'),
    checkOutDate: new Date('2030-06-13'),
    numGuests: 2,
    numNights: 3,
    totalPrice: 600,
    cabinPrice: 600,
  });
}
async function snapshot(id: string) {
  return JSON.stringify({
    booking: await Booking.findById(id).lean(),
    audits: await AuditLog.find({ resourceId: id }).lean(),
  });
}
for (const profile of profiles) {
  describe(`${profile.method} cancellation field presence`, () => {
    test('preserves the full denial field order without booking or audit writes', async () => {
      const booking = await fixture('unconfirmed');
      const id = String(booking._id);
      const before = await snapshot(id);
      const response = await profile.change({ id, body: fields });
      assert.ok(response);
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        success: false,
        error: `Cannot set ${profile.order} on a booking with status 'unconfirmed'. The booking must be cancelled first.`,
      });
      expect(await snapshot(id)).toBe(before);
    });
    test.each([
      { field: 'cancellationReason', body: { cancellationReason: '' } },
      { field: 'refundAmount', body: { refundAmount: 0 } },
    ])('counts a provided falsy $field as present', async ({ field, body }) => {
      const booking = await fixture('unconfirmed');
      const id = String(booking._id);
      const before = await snapshot(id);
      const response = await profile.change({ id, body });
      assert.ok(response);
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        success: false,
        error: `Cannot set ${field} on a booking with status 'unconfirmed'. The booking must be cancelled first.`,
      });
      expect(await snapshot(id)).toBe(before);
    });
    test('retains supplied empty/zero values and timestamps on a cancelled booking', async () => {
      const booking = await fixture('cancelled');
      const id = String(booking._id);
      const beforeReceipts = JSON.stringify(booking.payments);
      const response = await profile.change({ id, body: fields });
      assert.ok(response);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        success: true,
        data: fields,
      });
      const saved = await Booking.findById(id);
      expect(saved?.cancellationReason).toBe('');
      expect(saved?.refundAmount).toBe(0);
      expect(saved?.refundStatus).toBe('none');
      expect(saved?.cancelledAt?.toISOString()).toBe(cancelledAt);
      expect(saved?.refundedAt?.toISOString()).toBe(refundedAt);
      expect(JSON.stringify(saved?.payments)).toBe(beforeReceipts);
    });
  });
}
