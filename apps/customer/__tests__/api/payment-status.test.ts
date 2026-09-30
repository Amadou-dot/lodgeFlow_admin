/** @jest-environment node */
import Booking, { type IBooking } from '@lodgeflow/database/models/Booking';
import { NextRequest } from 'next/server';

const mockAuth = jest.fn<Promise<{ userId: string | null }>, []>();
const mockConnect = jest.fn<Promise<void>, []>();
const mockFindById = jest.fn<Promise<IBooking | null>, [string]>();
jest.mock('@clerk/nextjs/server', () => ({ auth: () => mockAuth() }));
jest.mock('@lodgeflow/database', () => ({
  connectDB: () => mockConnect(),
  Booking: { findById: (id: string) => mockFindById(id) },
}));

import { GET } from '@/app/api/payments/[bookingId]/route';

const bookingId = '507f1f77bcf86cd7994390ab';
function booking() {
  return new Booking({
    _id: bookingId,
    customer: 'customer',
    cabin: '507f1f77bcf86cd799439011',
    checkInDate: new Date('2030-06-01T00:00:00Z'),
    checkOutDate: new Date('2030-06-04T00:00:00Z'),
    numNights: 3,
    numGuests: 2,
    cabinPrice: 100,
    totalPrice: 300.5,
    depositAmount: 75.25,
    observations: 'Private booking note',
    checkoutToken: 'private-quote',
  });
}
function request(id = bookingId) {
  return GET(new NextRequest(`http://localhost/api/payments/${id}`), {
    params: Promise.resolve({ bookingId: id }),
  });
}
beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockAuth.mockResolvedValue({ userId: 'customer' });
  mockConnect.mockResolvedValue();
  mockFindById.mockResolvedValue(booking());
});
afterEach(() => jest.restoreAllMocks());

describe('payment-status characterization', () => {
  test('returns only payment fields, major-unit amounts and ISO timestamps', async () => {
    const row = booking();
    row.$set({
      amountPaid: 125.25,
      remainingAmount: 175.25,
      depositPaid: true,
      paidAt: new Date('2030-05-01T10:30:00-06:00'),
      stripeSessionId: 'cs_saved',
      refundAmount: 7.25,
      refundedAt: new Date('2030-05-02T10:30:00-06:00'),
    });
    mockFindById.mockResolvedValue(row);
    const snapshot = JSON.stringify(row);
    const response = await request();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: {
        isPaid: false,
        depositPaid: true,
        depositAmount: 75.25,
        totalPrice: 300.5,
        amountPaid: 125.25,
        remainingAmount: 175.25,
        paidAt: '2030-05-01T16:30:00.000Z',
        stripeSessionId: 'cs_saved',
        refundAmount: 7.25,
        refundedAt: '2030-05-02T16:30:00.000Z',
      },
    });
    expect(JSON.stringify(row)).toBe(snapshot);
  });

  test('preserves hydrated defaults and omits absent optional fields', async () => {
    const response = await request();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: {
        isPaid: false,
        depositPaid: false,
        depositAmount: 75.25,
        totalPrice: 300.5,
        amountPaid: 0,
        remainingAmount: 0,
      },
    });
  });

  test('preserves explicit legacy null timestamps, session and refund amount', async () => {
    const row = booking();
    row.$set({
      paidAt: null,
      stripeSessionId: null,
      refundAmount: null,
      refundedAt: null,
    });
    mockFindById.mockResolvedValue(row);
    const response = await request();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: {
        isPaid: false,
        depositPaid: false,
        depositAmount: 75.25,
        totalPrice: 300.5,
        amountPaid: 0,
        remainingAmount: 0,
        paidAt: null,
        stripeSessionId: null,
        refundAmount: null,
        refundedAt: null,
      },
    });
  });

  test('permits reads of cancelled bookings and uppercase object IDs', async () => {
    const row = booking();
    row.status = 'cancelled';
    mockFindById.mockResolvedValue(row);
    expect((await request(bookingId.toUpperCase())).status).toBe(200);
    expect(mockFindById).toHaveBeenCalledWith(bookingId.toUpperCase());
  });

  test.each(['missing', 'foreign'])(
    'returns the same 404 for %s bookings',
    async kind => {
      const row = booking();
      row.customer = 'other-customer';
      mockFindById.mockResolvedValue(kind === 'missing' ? null : row);
      const response = await request();
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        success: false,
        error: 'Booking not found',
      });
    }
  );

  test.each([bookingId, 'invalid'])(
    'authenticates before database access for %s',
    async id => {
      mockAuth.mockResolvedValue({ userId: null });
      const response = await request(id);
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        success: false,
        error: 'Authentication required',
      });
      expect(mockConnect).not.toHaveBeenCalled();
      expect(mockFindById).not.toHaveBeenCalled();
    }
  );

  test.each(['auth', 'connection', 'query'])(
    'returns a safe 500 on %s failure',
    async boundary => {
      const failure = new Error('private connection details');
      if (boundary === 'auth') mockAuth.mockRejectedValue(failure);
      if (boundary === 'connection') mockConnect.mockRejectedValue(failure);
      if (boundary === 'query') mockFindById.mockRejectedValue(failure);
      const response = await request();
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        success: false,
        error: 'Failed to fetch payment status',
      });
    }
  );
});

describe('payment-status invalid-ID regression', () => {
  test.each([
    'invalid',
    '123456789012',
    '507f1f77bcf86cd7994390az',
    `${bookingId} `,
  ])('rejects %s before database access', async id => {
    mockFindById.mockRejectedValue(new Error('MongoDB cast failure'));
    const response = await request(id);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Invalid booking ID',
    });
    expect(mockConnect).not.toHaveBeenCalled();
    expect(mockFindById).not.toHaveBeenCalled();
  });
});
