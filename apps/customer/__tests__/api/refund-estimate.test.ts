/** @jest-environment node */
const mockAuth = jest.fn();
const mockFindBooking = jest.fn();
const mockFindSettings = jest.fn();
jest.mock('@clerk/nextjs/server', () => ({ auth: () => mockAuth() }));
jest.mock('@lodgeflow/database', () => ({
  connectDB: jest.fn(),
  Booking: { findById: () => mockFindBooking() },
  Settings: { findOne: () => mockFindSettings() },
}));
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/bookings/[id]/refund-estimate/route';
import { getCancellationDeadlines } from '@/lib/cancellation';
import { connectDB } from '@lodgeflow/database';
import { logger } from '@lodgeflow/database/logger';

const booking = {
  customer: 'user_owner',
  checkInDate: new Date('2030-02-15T12:00:00.000Z'),
  status: 'confirmed',
  amountPaid: 75,
  refundAmount: 0,
  checkoutPending: false,
};
const request = (id = '507f1f77bcf86cd799439011') =>
  GET(
    new NextRequest('http://localhost/api/bookings/booking/refund-estimate'),
    { params: Promise.resolve({ id }) }
  );

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(new Date('2030-02-01T12:00:00.000Z'));
  mockAuth.mockResolvedValue({ userId: 'user_owner' });
  mockFindBooking.mockResolvedValue({ ...booking });
  mockFindSettings.mockResolvedValue({ cancellationPolicy: 'moderate' });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('conceals an invalid ID before database access', async () => {
  const response = await request('invalid');
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({
    success: false,
    error: 'Booking not found',
  });
  expect(connectDB).not.toHaveBeenCalled();
  expect(mockFindBooking).not.toHaveBeenCalled();
});

it('logs an unexpected failure while returning the safe error envelope', async () => {
  const failure = new Error('private database details');
  mockFindBooking.mockRejectedValueOnce(failure);
  const logged = jest.spyOn(logger, 'error').mockImplementation(() => {});
  const response = await request();
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({
    success: false,
    error: 'Failed to calculate refund estimate',
  });
  expect(logged).toHaveBeenCalledWith(
    'Error calculating refund estimate',
    failure
  );
});

it('returns received-money estimate with ISO deadlines and the existing envelope', async () => {
  const response = await request();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    success: true,
    data: {
      estimate: {
        refundPercentage: 100,
        refundAmount: 75,
        refundType: 'full',
        reason: 'Full refund - cancelled 5 or more days before check-in',
        daysUntilCheckIn: 14,
        policy: 'moderate',
      },
      deadlines: JSON.parse(
        JSON.stringify(
          getCancellationDeadlines(booking.checkInDate, 'moderate')
        )
      ),
      policyDescription:
        'Full refund 5+ days before check-in, 50% refund 2-5 days before, no refund within 2 days',
      canCancel: true,
    },
  });
});

it.each(['checked-in', 'checked-out', 'cancelled'])(
  'preserves non-cancellable %s output without settings',
  async status => {
    mockFindBooking.mockResolvedValue({ ...booking, status });
    mockFindSettings.mockResolvedValue(null);
    const response = await request();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      data: {
        canCancel: false,
        cancelNotAllowedReason: `Booking is already ${status}`,
        estimate: { refundAmount: 0, refundType: 'none' },
        deadlines: { fullRefundDeadline: null, partialRefundDeadline: null },
      },
    });
  }
);

it('conceals foreign bookings with the same response as a missing booking', async () => {
  mockFindBooking.mockResolvedValue({ ...booking, customer: 'user_foreign' });
  const foreign = await request();
  mockFindBooking.mockResolvedValue(null);
  const missing = await request();
  expect(foreign.status).toBe(404);
  expect(missing.status).toBe(404);
  expect(await foreign.json()).toEqual(await missing.json());
});

it('disallows cancellation during active checkout while preserving the policy estimate', async () => {
  mockFindBooking.mockResolvedValue({ ...booking, checkoutPending: true });
  const response = await request();
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    success: true,
    data: {
      canCancel: false,
      cancelNotAllowedReason:
        'Checkout is active; complete or expire it before cancelling',
      estimate: { refundAmount: 75 },
    },
  });
});
