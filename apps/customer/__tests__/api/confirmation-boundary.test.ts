/** @jest-environment node */
import { Types } from 'mongoose';
import type { serializeBookingEmailBooking } from '@/lib/serializers/booking-email';
import type { BookingEmailCabin } from '@/types/booking-email';
import type { ExperienceEmailSource } from '@/lib/serializers/experience-email';

const mockAuth = jest.fn();
const mockCurrentUser = jest.fn();
const mockConnect = jest.fn();
const mockFind = jest.fn();
const mockSend = jest.fn();
const mockLog = jest.fn();
jest.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
  currentUser: () => mockCurrentUser(),
}));
jest.mock('@lodgeflow/database', () => ({
  connectDB: () => mockConnect(),
  Booking: { findById: (...args: unknown[]) => mockFind(...args) },
  ExperienceBooking: { findById: (...args: unknown[]) => mockFind(...args) },
}));
jest.mock('@lodgeflow/database/logger', () => ({
  logger: { error: (...args: unknown[]) => mockLog(...args) },
}));
jest.mock('@/lib/resend', () => ({
  getResend: () => ({ emails: { send: mockSend } }),
}));
jest.mock('@/components/EmailTemplates', () => ({
  BookingConfirmationEmail: () => null,
  PaymentConfirmationEmail: () => null,
  ExperienceBookingConfirmationEmail: () => null,
}));
import { POST as confirm } from '@/app/api/send/confirm/route';
import { POST as payment } from '@/app/api/send/payment-confirm/route';
import { POST as experience } from '@/app/api/send/experience-confirm/route';

const bookingId = '507f1f77bcf86cd7994390ab';
function row() {
  return {
    _id: new Types.ObjectId(bookingId),
    customer: 'customer',
    cabin: {
      name: 'Pine',
      amenities: [],
      capacity: 4,
      price: 37.5,
      description: 'Cabin',
    } satisfies BookingEmailCabin,
    experience: {
      name: 'Walk',
      duration: '1 hour',
      price: 37.5,
      includes: [],
      whatToBring: [],
    } satisfies ExperienceEmailSource,
    checkInDate: new Date('2030-06-03'),
    checkOutDate: new Date('2030-06-05'),
    date: new Date('2030-06-03'),
    numParticipants: 2,
    numNights: 2,
    numGuests: 2,
    totalPrice: 75,
    extrasPrice: 0,
    depositAmount: 0,
    remainingAmount: 0,
    extras: {
      hasBreakfast: false,
      breakfastPrice: 0,
      hasPets: false,
      petFee: 0,
      hasParking: false,
      parkingFee: 0,
      hasEarlyCheckIn: false,
      earlyCheckInFee: 0,
      hasLateCheckOut: false,
      lateCheckOutFee: 0,
    } satisfies Parameters<typeof serializeBookingEmailBooking>[0]['extras'],
    payments: [{ amount: 75 }],
    isPaid: true,
  };
}
function useRow(value: ReturnType<typeof row> | null) {
  mockFind.mockImplementation(() => ({
    populate: () => {
      const result = Promise.resolve(value);
      return Object.assign(result, { lean: () => result });
    },
  }));
}
function request(body: unknown = { bookingId }) {
  return new Request('http://localhost/api/send/confirm', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
function malformedRequest() {
  return new Request('http://localhost/api/send/confirm', {
    method: 'POST',
    body: '{',
  });
}
beforeEach(() => {
  jest.resetAllMocks();
  mockAuth.mockResolvedValue({ userId: 'customer' });
  mockCurrentUser.mockResolvedValue({
    firstName: 'Avery',
    emailAddresses: [{ emailAddress: 'guest@example.invalid' }],
  });
  useRow(row());
  mockSend.mockResolvedValue({ data: { id: 'message' }, error: null });
});

describe.each([
  ['cabin', confirm],
  ['payment', payment],
  ['experience', experience],
] as const)('%s confirmation request boundary', (_kind, handler) => {
  describe('characterization', () => {
    test('auth denial precedes malformed body parsing and database access', async () => {
      mockAuth.mockResolvedValue({ userId: null });
      const response = await handler(malformedRequest());
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        error: 'Authentication required',
      });
      expect(mockConnect).not.toHaveBeenCalled();
      expect(mockSend).not.toHaveBeenCalled();
    });
    test('missing ID retains its 400 envelope without database access', async () => {
      const response = await handler(request({}));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: 'Booking ID is required',
      });
      expect(mockConnect).not.toHaveBeenCalled();
      expect(mockSend).not.toHaveBeenCalled();
    });
    test('valid ID and extra input preserve provider ID, verified recipient and booking state', async () => {
      const booking = row();
      const before = JSON.stringify(booking);
      useRow(booking);
      const response = await handler(
        request({ bookingId, email: 'foreign@example.invalid', totalPrice: 1 })
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ id: 'message' });
      expect(mockFind).toHaveBeenCalledWith(bookingId);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'guest@example.invalid' })
      );
      expect(JSON.stringify(booking)).toBe(before);
    });
    test('foreign booking remains 403 without identity lookup or send', async () => {
      useRow({ ...row(), customer: 'foreign' });
      const response = await handler(request());
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        error: 'Not authorized to send this confirmation',
      });
      expect(mockCurrentUser).not.toHaveBeenCalled();
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe('regressions', () => {
    test('malformed JSON returns safe 400 before database access', async () => {
      const response = await handler(malformedRequest());
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid JSON body' });
      expect(mockConnect).not.toHaveBeenCalled();
      expect(mockSend).not.toHaveBeenCalled();
    });
    test.each([{ body: null }, { body: [] }, { body: 'booking' }])(
      'rejects non-object body $body without effects',
      async ({ body }) => {
        const response = await handler(request(body));
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({
          error: 'Invalid request body',
        });
        expect(mockConnect).not.toHaveBeenCalled();
        expect(mockSend).not.toHaveBeenCalled();
      }
    );
    test.each([
      { id: { $ne: null } },
      { id: [bookingId] },
      { id: 123 },
      { id: true },
      { id: 'not-an-id' },
      { id: 'a'.repeat(25) },
      { id: ` ${bookingId}` },
    ])(
      'rejects invalid booking ID $id without database/provider calls',
      async ({ id }) => {
        const response = await handler(request({ bookingId: id }));
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ error: 'Invalid booking ID' });
        expect(mockConnect).not.toHaveBeenCalled();
        expect(mockFind).not.toHaveBeenCalled();
        expect(mockSend).not.toHaveBeenCalled();
      }
    );
    test.each(['auth', 'database', 'identity', 'provider'] as const)(
      'conceals %s exceptions and logs failure',
      async source => {
        const secret = new Error('private synthetic dependency details');
        const dependency = {
          auth: mockAuth,
          database: mockConnect,
          identity: mockCurrentUser,
          provider: mockSend,
        }[source];
        dependency.mockRejectedValueOnce(secret);
        const booking = row();
        const before = JSON.stringify(booking);
        useRow(booking);
        const response = await handler(request());
        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({
          error: 'Failed to send confirmation email',
        });
        expect(mockLog).toHaveBeenCalled();
        expect(JSON.stringify(booking)).toBe(before);
        if (source !== 'provider') expect(mockSend).not.toHaveBeenCalled();
      }
    );
    test('conceals returned provider errors and permits retry without changing booking state', async () => {
      const booking = row();
      const before = JSON.stringify(booking);
      useRow(booking);
      mockSend.mockResolvedValueOnce({
        data: null,
        error: {
          message: 'private synthetic provider details',
          name: 'validation_error',
          statusCode: 422,
        },
      });
      const response = await handler(request());
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        error: 'Failed to send confirmation email',
      });
      expect(mockLog).toHaveBeenCalled();
      expect((await handler(request())).status).toBe(200);
      expect(JSON.stringify(booking)).toBe(before);
    });
  });
});
