import mongoose from 'mongoose';
import { NextRequest } from 'next/server';

jest.mock('@/lib/mongodb', () => jest.fn().mockResolvedValue(undefined));

import { GET, POST, PUT, DELETE } from '@/app/api/bookings/route';
import Booking from '@/models/Booking';
import Cabin from '@/models/Cabin';
import Settings from '@/models/Settings';
import { settingsData } from '@/lib/data/seed-data';

// getClerkUsersBatch is already mocked in jest.setup.node.ts
// Override here to provide booking-specific customer data
import { getClerkUsersBatch } from '@/lib/clerk-users';
const mockGetClerkUsersBatch = getClerkUsersBatch as jest.MockedFunction<
  typeof getClerkUsersBatch
>;

// Helper to create a test cabin
async function createTestCabin(overrides: Record<string, any> = {}) {
  return Cabin.create({
    name: 'Test Cabin',
    description: 'A test cabin for booking tests',
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
  overrides: Record<string, any> = {}
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

// Helper to build NextRequest
function createRequest(url: string, options?: { method?: string; body?: any }) {
  const init: RequestInit = { method: options?.method || 'GET' };
  if (options?.body) {
    init.body = JSON.stringify(options.body);
    init.headers = { 'Content-Type': 'application/json' };
  }
  return new NextRequest(new URL(url, 'http://localhost:3000'), init);
}

describe('Bookings API Routes', () => {
  beforeEach(() => {
    // Setup mock Clerk batch response
    mockGetClerkUsersBatch.mockResolvedValue({
      users: new Map([
        [
          'user_test123',
          {
            id: 'user_test123',
            name: 'Test User',
            email: 'test@example.com',
          } as any,
        ],
      ]),
      errors: 0,
    });
  });

  describe('GET /api/bookings', () => {
    it('returns paginated bookings', async () => {
      const cabin = await createTestCabin();
      await createTestBooking(cabin._id);
      await createTestBooking(cabin._id, {
        customer: 'user_test456',
        checkInDate: new Date('2027-07-01'),
        checkOutDate: new Date('2027-07-04'),
      });

      // Also add user_test456 to mock
      mockGetClerkUsersBatch.mockResolvedValue({
        users: new Map([
          [
            'user_test123',
            {
              id: 'user_test123',
              name: 'Test User',
              email: 'test@example.com',
            } as any,
          ],
          [
            'user_test456',
            {
              id: 'user_test456',
              name: 'Other User',
              email: 'other@example.com',
            } as any,
          ],
        ]),
        errors: 0,
      });

      const request = createRequest('http://localhost:3000/api/bookings');
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(body.pagination.totalBookings).toBe(2);
    });

    it('filters by status', async () => {
      const cabin = await createTestCabin();
      await createTestBooking(cabin._id, { status: 'confirmed' });
      await createTestBooking(cabin._id, {
        status: 'cancelled',
        checkInDate: new Date('2027-07-01'),
        checkOutDate: new Date('2027-07-04'),
      });

      const request = createRequest(
        'http://localhost:3000/api/bookings?status=confirmed'
      );
      const response = await GET(request);
      const body = await response.json();

      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].status).toBe('confirmed');
    });

    it('returns empty data when no bookings', async () => {
      const request = createRequest('http://localhost:3000/api/bookings');
      const response = await GET(request);
      const body = await response.json();

      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(0);
      expect(body.pagination.totalBookings).toBe(0);
    });
  });

  describe('POST /api/bookings', () => {
    it('creates a booking with valid data', async () => {
      const cabin = await createTestCabin();

      const request = createRequest('http://localhost:3000/api/bookings', {
        method: 'POST',
        body: {
          cabin: cabin._id.toString(),
          customer: 'user_test123',
          checkInDate: '2027-08-01',
          checkOutDate: '2027-08-05',
          numNights: 4,
          numGuests: 2,
          cabinPrice: 800,
          totalPrice: 800,
        },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.customer).toBeDefined();
    });

    it('returns 404 when cabin does not exist', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const request = createRequest('http://localhost:3000/api/bookings', {
        method: 'POST',
        body: {
          cabin: fakeId.toString(),
          customer: 'user_test123',
          checkInDate: '2027-08-01',
          checkOutDate: '2027-08-05',
          numNights: 4,
          numGuests: 2,
          cabinPrice: 800,
          totalPrice: 800,
        },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toContain('Cabin not found');
    });

    it('returns 400 when cabin is inactive', async () => {
      const cabin = await createTestCabin({ status: 'inactive' });

      const request = createRequest('http://localhost:3000/api/bookings', {
        method: 'POST',
        body: {
          cabin: cabin._id.toString(),
          customer: 'user_test123',
          checkInDate: '2027-08-01',
          checkOutDate: '2027-08-05',
          numNights: 4,
          numGuests: 2,
          cabinPrice: 800,
          totalPrice: 800,
        },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('inactive');
    });

    it('returns validation error for missing required fields', async () => {
      const request = createRequest('http://localhost:3000/api/bookings', {
        method: 'POST',
        body: { cabin: 'abc' },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
    });

    it('enforces max guests per booking when settings document is missing', async () => {
      const cabin = await createTestCabin({ capacity: 20 });

      const request = createRequest('http://localhost:3000/api/bookings', {
        method: 'POST',
        body: {
          cabin: cabin._id.toString(),
          customer: 'user_test123',
          checkInDate: '2027-08-01',
          checkOutDate: '2027-08-05',
          numNights: 4,
          numGuests: settingsData.maxGuestsPerBooking + 1,
          cabinPrice: 800,
          totalPrice: 800,
        },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain(
        `Number of guests cannot exceed ${settingsData.maxGuestsPerBooking}`
      );
    });

    it('rejects guests above cabin capacity', async () => {
      const cabin = await createTestCabin({ capacity: 2 });

      const request = createRequest('http://localhost:3000/api/bookings', {
        method: 'POST',
        body: {
          cabin: cabin._id.toString(),
          customer: 'user_test123',
          checkInDate: '2027-08-01',
          checkOutDate: '2027-08-05',
          numNights: 4,
          numGuests: 3,
          cabinPrice: 800,
          totalPrice: 800,
        },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('Number of guests cannot exceed 2');
    });

    it('ignores client-supplied pricing fields and computes them from the cabin price', async () => {
      // Cabin is $200/night with no discount; 4-night stay should price at $800.
      const cabin = await createTestCabin({ price: 200, discount: 0 });

      const request = createRequest('http://localhost:3000/api/bookings', {
        method: 'POST',
        body: {
          cabin: cabin._id.toString(),
          customer: 'user_test123',
          checkInDate: '2027-08-01',
          checkOutDate: '2027-08-05',
          numGuests: 2,
          // Tampered pricing fields a malicious client might send.
          numNights: 999,
          cabinPrice: 1,
          extrasPrice: 1,
          totalPrice: 1,
        },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.data.numNights).toBe(4);
      expect(body.data.cabinPrice).toBe(200);
      expect(body.data.extrasPrice).toBe(0);
      expect(body.data.totalPrice).toBe(800);
    });

    it('applies the cabin discount when computing cabinPrice', async () => {
      const cabin = await createTestCabin({ price: 200, discount: 50 });

      const request = createRequest('http://localhost:3000/api/bookings', {
        method: 'POST',
        body: {
          cabin: cabin._id.toString(),
          customer: 'user_test123',
          checkInDate: '2027-08-01',
          checkOutDate: '2027-08-05',
          numGuests: 2,
        },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.data.cabinPrice).toBe(150);
      expect(body.data.totalPrice).toBe(600); // 150 * 4 nights
    });

    it('computes extras pricing from settings, ignoring a client-supplied extras fee amount', async () => {
      const cabin = await createTestCabin({ price: 200, discount: 0 });

      const request = createRequest('http://localhost:3000/api/bookings', {
        method: 'POST',
        body: {
          cabin: cabin._id.toString(),
          customer: 'user_test123',
          checkInDate: '2027-08-01',
          checkOutDate: '2027-08-05', // 4 nights
          numGuests: 2,
          extras: {
            hasBreakfast: true,
            breakfastPrice: 999999, // tampered — should be ignored
          },
        },
      });

      const response = await POST(request);
      const body = await response.json();

      // Default seeded settings.breakfastPrice is 15/guest/night.
      const expectedBreakfastPrice = 15 * 2 * 4;

      expect(response.status).toBe(201);
      expect(body.data.extras.breakfastPrice).toBe(expectedBreakfastPrice);
      expect(body.data.extrasPrice).toBe(expectedBreakfastPrice);
      expect(body.data.totalPrice).toBe(800 + expectedBreakfastPrice);
    });
  });

  describe('PUT /api/bookings', () => {
    it('allows status-only updates for legacy bookings that violate current settings', async () => {
      const cabin = await createTestCabin({ capacity: 4 });
      const booking = await createTestBooking(cabin._id);

      await Settings.create({
        ...settingsData,
        minBookingLength: 1,
        maxBookingLength: 1,
        maxGuestsPerBooking: 1,
      });

      const request = createRequest('http://localhost:3000/api/bookings', {
        method: 'PUT',
        body: {
          _id: booking._id.toString(),
          status: 'confirmed',
        },
      });

      const response = await PUT(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('confirmed');
    });

    it('auto-sets cancelledAt and refundStatus when status is cancelled', async () => {
      const cabin = await createTestCabin();
      const booking = await createTestBooking(cabin._id);

      const request = createRequest('http://localhost:3000/api/bookings', {
        method: 'PUT',
        body: {
          _id: booking._id.toString(),
          status: 'cancelled',
        },
      });

      const response = await PUT(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.cancelledAt).toBeDefined();
      expect(body.data.refundStatus).toBe('none');
    });

    it('preserves explicit cancelledAt when provided', async () => {
      const cabin = await createTestCabin();
      const booking = await createTestBooking(cabin._id);
      const explicitDate = '2027-05-01T12:00:00.000Z';

      const request = createRequest('http://localhost:3000/api/bookings', {
        method: 'PUT',
        body: {
          _id: booking._id.toString(),
          status: 'cancelled',
          cancelledAt: explicitDate,
        },
      });

      const response = await PUT(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(new Date(body.data.cancelledAt).toISOString()).toBe(explicitDate);
    });

    it('auto-sets paidAt when isPaid becomes true', async () => {
      const cabin = await createTestCabin();
      const booking = await createTestBooking(cabin._id, { isPaid: false });

      const request = createRequest('http://localhost:3000/api/bookings', {
        method: 'PUT',
        body: {
          _id: booking._id.toString(),
          isPaid: true,
        },
      });

      const response = await PUT(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.paidAt).toBeDefined();
    });

    it('does not overwrite paidAt on already-paid bookings', async () => {
      const cabin = await createTestCabin();
      const originalPaidAt = new Date('2027-01-15T10:00:00.000Z');
      const booking = await createTestBooking(cabin._id, {
        isPaid: true,
        paidAt: originalPaidAt,
      });

      const request = createRequest('http://localhost:3000/api/bookings', {
        method: 'PUT',
        body: {
          _id: booking._id.toString(),
          isPaid: true,
          numGuests: 3,
        },
      });

      const response = await PUT(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      // paidAt should remain the original timestamp
      expect(new Date(body.data.paidAt).toISOString()).toBe(
        originalPaidAt.toISOString()
      );
    });

    it('auto-sets refundedAt when refundStatus is full with refundAmount', async () => {
      const cabin = await createTestCabin();
      const booking = await createTestBooking(cabin._id, {
        status: 'cancelled',
      });

      const request = createRequest('http://localhost:3000/api/bookings', {
        method: 'PUT',
        body: {
          _id: booking._id.toString(),
          status: 'cancelled',
          refundStatus: 'full',
          refundAmount: 600,
        },
      });

      const response = await PUT(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.refundedAt).toBeDefined();
    });

    it('rejects refund fields on non-cancelled bookings', async () => {
      const cabin = await createTestCabin();
      const booking = await createTestBooking(cabin._id, {
        status: 'confirmed',
      });

      const request = createRequest('http://localhost:3000/api/bookings', {
        method: 'PUT',
        body: {
          _id: booking._id.toString(),
          status: 'confirmed',
          refundStatus: 'pending',
          refundAmount: 100,
        },
      });

      const response = await PUT(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error).toContain('refundStatus');
    });

    it('recalculates numNights when dates change', async () => {
      const cabin = await createTestCabin();
      const booking = await createTestBooking(cabin._id, {
        checkInDate: new Date('2027-06-01'),
        checkOutDate: new Date('2027-06-04'),
        numNights: 3,
      });

      const request = createRequest('http://localhost:3000/api/bookings', {
        method: 'PUT',
        body: {
          _id: booking._id.toString(),
          checkOutDate: '2027-06-08',
        },
      });

      const response = await PUT(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.numNights).toBe(7); // June 1 to June 8
    });

    it('recalculates remainingAmount when totalPrice changes', async () => {
      const cabin = await createTestCabin();
      const booking = await createTestBooking(cabin._id, {
        totalPrice: 600,
        depositAmount: 200,
      });

      const request = createRequest('http://localhost:3000/api/bookings', {
        method: 'PUT',
        body: {
          _id: booking._id.toString(),
          totalPrice: 1000,
        },
      });

      const response = await PUT(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.remainingAmount).toBe(800); // 1000 - 200
    });
  });

  describe('DELETE /api/bookings', () => {
    it('deletes an existing booking', async () => {
      const cabin = await createTestCabin();
      const booking = await createTestBooking(cabin._id);

      const request = createRequest(
        `http://localhost:3000/api/bookings?id=${booking._id}`
      );
      const response = await DELETE(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);

      // Verify it's actually deleted
      const found = await Booking.findById(booking._id);
      expect(found).toBeNull();
    });

    it('returns 404 for non-existent booking', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const request = createRequest(
        `http://localhost:3000/api/bookings?id=${fakeId}`
      );
      const response = await DELETE(request);

      expect(response.status).toBe(404);
    });

    it('returns 400 when no ID provided', async () => {
      const request = createRequest('http://localhost:3000/api/bookings');
      const response = await DELETE(request);

      expect(response.status).toBe(400);
    });
  });
});
