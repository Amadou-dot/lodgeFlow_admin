import mongoose from 'mongoose';

jest.mock('@/lib/mongodb', () => jest.fn().mockResolvedValue(undefined));

import { PATCH } from '@/app/api/bookings/[id]/route';
import Booking from '@/models/Booking';
import Cabin from '@/models/Cabin';

// Helper to create a test cabin
async function createTestCabin(overrides: Record<string, unknown> = {}) {
  return Cabin.create({
    name: 'Test Cabin',
    description: 'A test cabin for PATCH tests',
    capacity: 4,
    price: 200,
    discount: 0,
    image: 'https://example.com/cabin.jpg',
    amenities: ['WiFi'],
    status: 'active',
    ...overrides,
  });
}

// Helper to create a booking directly in DB
async function createTestBooking(
  cabinId: mongoose.Types.ObjectId,
  overrides: Record<string, unknown> = {}
) {
  return Booking.create({
    cabin: cabinId,
    customer: 'user_test123',
    checkInDate: new Date('2027-06-01'),
    checkOutDate: new Date('2027-06-04'),
    numNights: 3,
    numGuests: 2,
    cabinPrice: 600,
    totalPrice: 600,
    ...overrides,
  });
}

// Helper to call the PATCH handler
async function callPatch(bookingId: string, body: Record<string, unknown>) {
  const req = new Request('http://localhost:3000/api/bookings/' + bookingId, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
  const params = Promise.resolve({ id: bookingId });
  return PATCH(req, { params });
}

describe('PATCH /api/bookings/[id]', () => {
  describe('recordPayment', () => {
    it('records a partial payment correctly', async () => {
      const cabin = await createTestCabin();
      const booking = await createTestBooking(cabin._id, { totalPrice: 1000 });

      const response = await callPatch(booking._id.toString(), {
        recordPayment: {
          paymentMethod: 'card',
          amountPaid: 300,
        },
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.depositAmount).toBe(300);
      expect(body.data.remainingAmount).toBe(700);
      expect(body.data.isPaid).toBe(false);
      expect(body.data.depositPaid).toBe(true);
      expect(body.data.paidAt).toBeUndefined();
    });

    it('marks booking as fully paid when balance reaches zero', async () => {
      const cabin = await createTestCabin();
      const booking = await createTestBooking(cabin._id, { totalPrice: 500 });

      const response = await callPatch(booking._id.toString(), {
        recordPayment: {
          paymentMethod: 'card',
          amountPaid: 500,
        },
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.isPaid).toBe(true);
      expect(body.data.remainingAmount).toBe(0);
      expect(body.data.paidAt).toBeDefined();
    });

    it('clamps remainingAmount to 0 on overpayment', async () => {
      const cabin = await createTestCabin();
      const booking = await createTestBooking(cabin._id, { totalPrice: 200 });

      const response = await callPatch(booking._id.toString(), {
        recordPayment: {
          paymentMethod: 'card',
          amountPaid: 300,
        },
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.remainingAmount).toBe(0);
      expect(body.data.isPaid).toBe(true);
      expect(body.data.depositAmount).toBe(300);
    });

    it('accumulates multiple sequential payments', async () => {
      const cabin = await createTestCabin();
      const booking = await createTestBooking(cabin._id, { totalPrice: 1000 });

      // First payment
      await callPatch(booking._id.toString(), {
        recordPayment: { paymentMethod: 'card', amountPaid: 400 },
      });

      // Second payment
      const response = await callPatch(booking._id.toString(), {
        recordPayment: { paymentMethod: 'card', amountPaid: 400 },
      });
      const body = await response.json();

      expect(body.data.depositAmount).toBe(800);
      expect(body.data.remainingAmount).toBe(200);
      expect(body.data.isPaid).toBe(false);
    });

    it('truncates observations to 1000 characters when payment notes are appended', async () => {
      const cabin = await createTestCabin();
      const longObservations = 'X'.repeat(980);
      const paymentNotes = 'Extra payment details for the guest stay';
      // Combined would be: 980 + '\n\nPayment recorded: ' + notes > 1000
      const booking = await createTestBooking(cabin._id, {
        totalPrice: 1000,
        observations: longObservations,
      });

      const response = await callPatch(booking._id.toString(), {
        recordPayment: {
          paymentMethod: 'card',
          amountPaid: 100,
          notes: paymentNotes,
        },
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      // The combined string exceeds 1000 chars; .slice(0, 1000) enforces the cap
      expect(body.data.observations.length).toBeLessThanOrEqual(1000);
      expect(body.data.observations.length).toBeGreaterThan(
        longObservations.length
      );
    });

    it('rejects requests with both recordPayment and paidAt', async () => {
      const cabin = await createTestCabin();
      const booking = await createTestBooking(cabin._id, { totalPrice: 100 });
      const backdatedDate = '2020-01-01T00:00:00.000Z';

      const response = await callPatch(booking._id.toString(), {
        recordPayment: { paymentMethod: 'card', amountPaid: 100 },
        paidAt: backdatedDate,
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
    });
  });

  describe('status transitions', () => {
    it('auto-sets cancelledAt when status changes to cancelled', async () => {
      const cabin = await createTestCabin();
      const booking = await createTestBooking(cabin._id);

      const response = await callPatch(booking._id.toString(), {
        status: 'cancelled',
      });
      const body = await response.json();

      expect(body.data.status).toBe('cancelled');
      expect(body.data.cancelledAt).toBeDefined();
      expect(body.data.refundStatus).toBe('none');
    });

    it('uses explicit cancelledAt when provided with cancellation', async () => {
      const cabin = await createTestCabin();
      const booking = await createTestBooking(cabin._id);
      const explicitDate = '2027-03-15T12:00:00.000Z';

      const response = await callPatch(booking._id.toString(), {
        status: 'cancelled',
        cancelledAt: explicitDate,
      });
      const body = await response.json();

      expect(new Date(body.data.cancelledAt).toISOString()).toBe(explicitDate);
    });

    it('auto-sets checkInTime when status changes to checked-in', async () => {
      const cabin = await createTestCabin();
      const booking = await createTestBooking(cabin._id, {
        status: 'confirmed',
      });

      const response = await callPatch(booking._id.toString(), {
        status: 'checked-in',
      });
      const body = await response.json();

      expect(body.data.status).toBe('checked-in');
      expect(body.data.checkInTime).toBeDefined();
    });

    it('auto-sets checkOutTime when status changes to checked-out', async () => {
      const cabin = await createTestCabin();
      const booking = await createTestBooking(cabin._id, {
        status: 'checked-in',
      });

      const response = await callPatch(booking._id.toString(), {
        status: 'checked-out',
      });
      const body = await response.json();

      expect(body.data.status).toBe('checked-out');
      expect(body.data.checkOutTime).toBeDefined();
    });
  });

  describe('cancellation metadata guard', () => {
    it('allows cancellationReason on cancelled bookings', async () => {
      const cabin = await createTestCabin();
      const booking = await createTestBooking(cabin._id, {
        status: 'cancelled',
      });

      const response = await callPatch(booking._id.toString(), {
        cancellationReason: 'Guest changed plans',
      });
      const body = await response.json();

      expect(body.data.cancellationReason).toBe('Guest changed plans');
    });

    it('rejects cancellationReason on non-cancelled bookings', async () => {
      const cabin = await createTestCabin();
      const booking = await createTestBooking(cabin._id, {
        status: 'confirmed',
      });

      const response = await callPatch(booking._id.toString(), {
        cancellationReason: 'Should not be set',
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain('cancellationReason');
      expect(body.error).toContain('confirmed');
    });

    it('allows refundStatus updates on cancelled bookings', async () => {
      const cabin = await createTestCabin();
      const booking = await createTestBooking(cabin._id, {
        status: 'cancelled',
      });

      const response = await callPatch(booking._id.toString(), {
        refundStatus: 'pending',
      });
      const body = await response.json();

      expect(body.data.refundStatus).toBe('pending');
    });

    it('ignores cancelledAt on non-cancelled bookings', async () => {
      const cabin = await createTestCabin();
      const booking = await createTestBooking(cabin._id, {
        status: 'confirmed',
      });

      const response = await callPatch(booking._id.toString(), {
        cancelledAt: '2027-01-01T00:00:00.000Z',
      });
      const body = await response.json();

      expect(body.data.cancelledAt).toBeUndefined();
    });
  });

  describe('validation', () => {
    it('returns 400 for invalid refundStatus', async () => {
      const cabin = await createTestCabin();
      const booking = await createTestBooking(cabin._id);

      const response = await callPatch(booking._id.toString(), {
        refundStatus: 'invalid_status',
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
    });

    it('returns 400 for negative refundAmount', async () => {
      const cabin = await createTestCabin();
      const booking = await createTestBooking(cabin._id);

      const response = await callPatch(booking._id.toString(), {
        refundAmount: -50,
      });

      expect(response.status).toBe(400);
    });

    it('returns 404 for non-existent booking', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await callPatch(fakeId.toString(), {
        status: 'confirmed',
      });

      expect(response.status).toBe(404);
    });
  });

  describe('status transition validation', () => {
    it('rejects invalid transition from unconfirmed to checked-in', async () => {
      const cabin = await createTestCabin();
      const booking = await createTestBooking(cabin._id, {
        status: 'unconfirmed',
      });

      const response = await callPatch(booking._id.toString(), {
        status: 'checked-in',
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain(
        "Cannot transition from 'unconfirmed' to 'checked-in'"
      );
    });

    it('rejects transition from checked-out (terminal state)', async () => {
      const cabin = await createTestCabin();
      const booking = await createTestBooking(cabin._id, {
        status: 'checked-out',
      });

      const response = await callPatch(booking._id.toString(), {
        status: 'confirmed',
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain(
        "Cannot transition from 'checked-out' to 'confirmed'"
      );
    });

    it('rejects transition from cancelled (terminal state)', async () => {
      const cabin = await createTestCabin();
      const booking = await createTestBooking(cabin._id, {
        status: 'cancelled',
      });

      const response = await callPatch(booking._id.toString(), {
        status: 'confirmed',
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain(
        "Cannot transition from 'cancelled' to 'confirmed'"
      );
    });

    it('allows valid transition from confirmed to checked-in', async () => {
      const cabin = await createTestCabin();
      const booking = await createTestBooking(cabin._id, {
        status: 'confirmed',
      });

      const response = await callPatch(booking._id.toString(), {
        status: 'checked-in',
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.status).toBe('checked-in');
    });

    it('allows cancellation from any non-terminal state', async () => {
      const cabin = await createTestCabin();
      const booking = await createTestBooking(cabin._id, {
        status: 'checked-in',
      });

      const response = await callPatch(booking._id.toString(), {
        status: 'cancelled',
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.status).toBe('cancelled');
    });
  });

  describe('refund metadata guard', () => {
    it('rejects refundAmount on non-cancelled bookings', async () => {
      const cabin = await createTestCabin();
      const booking = await createTestBooking(cabin._id, {
        status: 'confirmed',
      });

      const response = await callPatch(booking._id.toString(), {
        refundAmount: 500,
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain('refundAmount');
    });

    it('rejects refundedAt on non-cancelled bookings', async () => {
      const cabin = await createTestCabin();
      const booking = await createTestBooking(cabin._id, {
        status: 'confirmed',
      });

      const response = await callPatch(booking._id.toString(), {
        refundedAt: '2027-01-01T00:00:00.000Z',
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain('refundedAt');
    });

    it('allows refundAmount on cancelled bookings', async () => {
      const cabin = await createTestCabin();
      const booking = await createTestBooking(cabin._id, {
        status: 'cancelled',
      });

      const response = await callPatch(booking._id.toString(), {
        refundAmount: 300,
        refundStatus: 'full',
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.refundAmount).toBe(300);
    });

    it('rejects refundAmount exceeding totalPrice', async () => {
      const cabin = await createTestCabin();
      const booking = await createTestBooking(cabin._id, {
        totalPrice: 600,
      });

      // Cancel the booking first
      await callPatch(booking._id.toString(), { status: 'cancelled' });

      // Attempt refund exceeding totalPrice
      const response = await callPatch(booking._id.toString(), {
        refundAmount: 999,
        refundStatus: 'full',
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain('cannot exceed total price');
    });

    it('allows refundedAt on cancelled bookings', async () => {
      const cabin = await createTestCabin();
      const booking = await createTestBooking(cabin._id, {
        status: 'cancelled',
      });
      const refundDate = '2027-06-15T14:00:00.000Z';

      const response = await callPatch(booking._id.toString(), {
        refundedAt: refundDate,
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(new Date(body.data.refundedAt).toISOString()).toBe(refundDate);
    });

    it('allows setting refundStatus with status=cancelled on already-cancelled booking', async () => {
      const cabin = await createTestCabin();
      const booking = await createTestBooking(cabin._id, {
        status: 'cancelled',
        refundStatus: 'none',
      });

      const response = await callPatch(booking._id.toString(), {
        refundStatus: 'full',
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.refundStatus).toBe('full');
    });
  });

  describe('payment metadata', () => {
    it('sets stripe fields via PATCH', async () => {
      const cabin = await createTestCabin();
      const booking = await createTestBooking(cabin._id);

      const response = await callPatch(booking._id.toString(), {
        stripePaymentIntentId: 'pi_test_abc123',
        stripeSessionId: 'cs_test_xyz789',
      });
      const body = await response.json();

      expect(body.data.stripePaymentIntentId).toBe('pi_test_abc123');
      expect(body.data.stripeSessionId).toBe('cs_test_xyz789');
    });

    it('sets paymentConfirmationSentAt via PATCH', async () => {
      const cabin = await createTestCabin();
      const booking = await createTestBooking(cabin._id);
      const sentDate = '2027-06-01T10:05:00.000Z';

      const response = await callPatch(booking._id.toString(), {
        paymentConfirmationSentAt: sentDate,
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(new Date(body.data.paymentConfirmationSentAt).toISOString()).toBe(
        sentDate
      );
    });

    it('sets paidAt directly when no recordPayment', async () => {
      const cabin = await createTestCabin();
      const booking = await createTestBooking(cabin._id);
      const paidDate = '2027-06-01T10:00:00.000Z';

      const response = await callPatch(booking._id.toString(), {
        paidAt: paidDate,
      });
      const body = await response.json();

      expect(new Date(body.data.paidAt).toISOString()).toBe(paidDate);
    });
  });
});
