/** @jest-environment node */
const mockSend = jest.fn();
const mockFindById = jest.fn();
const mockUpdateOne = jest.fn();
jest.mock('@/lib/resend', () => ({
  getResend: () => ({ emails: { send: mockSend } }),
}));
jest.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: 'customer' }),
  currentUser: async () => ({
    emailAddresses: [{ emailAddress: 'guest@example.com' }],
  }),
  clerkClient: async () => ({
    users: {
      getUser: async () => ({
        emailAddresses: [{ id: 'email', emailAddress: 'guest@example.com' }],
        primaryEmailAddressId: 'email',
      }),
    },
  }),
}));
jest.mock('@lodgeflow/database', () => ({
  connectDB: jest.fn(),
  Booking: { findById: (...args: unknown[]) => mockFindById(...args) },
  DiningReservation: {
    findById: (...args: unknown[]) => mockFindById(...args),
    updateOne: (...args: unknown[]) => mockUpdateOne(...args),
  },
  ExperienceBooking: {
    findById: (...args: unknown[]) => mockFindById(...args),
    updateOne: (...args: unknown[]) => mockUpdateOne(...args),
  },
}));
jest.mock('@/components/EmailTemplates', () => ({
  WelcomeEmail: () => null,
  BookingConfirmationEmail: () => null,
  PaymentConfirmationEmail: () => null,
  DiningReservationConfirmationEmail: () => null,
  ExperienceBookingConfirmationEmail: () => null,
}));
import { POST as welcome } from '@/app/api/send/welcome/route';
import { POST as payment } from '@/app/api/send/payment-confirm/route';
import { POST as dining } from '@/app/api/send/dining-confirm/route';
import { POST as experience } from '@/app/api/send/experience-confirm/route';
import { sendReservationConfirmation } from '@/lib/reservation-confirmation-email';
import { sendCancellationConfirmationEmail } from '@/lib/email';
import { EmailSenderConfigurationError } from '@lodgeflow/email';
import { Types } from 'mongoose';

const originalPayment = process.env.LODGEFLOW_PAYMENT_EMAIL_FROM;
const originalNotification = process.env.LODGEFLOW_NOTIFICATION_EMAIL_FROM;
beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.LODGEFLOW_PAYMENT_EMAIL_FROM;
  delete process.env.LODGEFLOW_NOTIFICATION_EMAIL_FROM;
  mockSend.mockResolvedValue({ data: { id: 'message' }, error: null });
});
afterEach(() => {
  if (originalPayment === undefined)
    delete process.env.LODGEFLOW_PAYMENT_EMAIL_FROM;
  else process.env.LODGEFLOW_PAYMENT_EMAIL_FROM = originalPayment;
  if (originalNotification === undefined)
    delete process.env.LODGEFLOW_NOTIFICATION_EMAIL_FROM;
  else process.env.LODGEFLOW_NOTIFICATION_EMAIL_FROM = originalNotification;
  jest.restoreAllMocks();
});
function row(totalPrice: number) {
  return {
    _id: new Types.ObjectId('507f1f77bcf86cd7994390ab'),
    customer: 'customer',
    date: new Date('2030-01-01'),
    checkInDate: new Date('2030-01-01'),
    checkOutDate: new Date('2030-01-03'),
    isPaid: true,
    totalPrice,
    remainingAmount: 0,
    payments: [{ amount: totalPrice }],
    cabin: {},
    dining: {},
    experience: {},
  };
}
function useRow(totalPrice: number) {
  mockFindById.mockReturnValue({ populate: async () => row(totalPrice) });
}
function request() {
  return new Request('http://localhost/api/send', {
    method: 'POST',
    body: JSON.stringify({ bookingId: 'booking', reservationId: 'booking' }),
  });
}

test('welcome uses notification default and honors a lazy override', async () => {
  expect((await welcome()).status).toBe(200);
  expect(mockSend).toHaveBeenLastCalledWith(
    expect.objectContaining({ from: 'LodgeFlow <notifications@lodgeflow.app>' })
  );
  process.env.LODGEFLOW_NOTIFICATION_EMAIL_FROM = 'updates@example.com';
  await welcome();
  expect(mockSend).toHaveBeenLastCalledWith(
    expect.objectContaining({ from: 'LodgeFlow <updates@example.com>' })
  );
});
test('payment receipt uses payment sender', async () => {
  useRow(100);
  expect((await payment(request())).status).toBe(200);
  expect(mockSend).toHaveBeenCalledWith(
    expect.objectContaining({ from: 'LodgeFlow <payments@lodgeflow.app>' })
  );
});
for (const [kind, handler] of [
  ['dining', dining],
  ['experience', experience],
] as const) {
  for (const totalPrice of [0, 100]) {
    test(`${kind} manual and settlement confirmation use the same sender for ${totalPrice}`, async () => {
      useRow(totalPrice);
      const from = `LodgeFlow <${totalPrice > 0 ? 'payments' : 'notifications'}@lodgeflow.app>`;
      expect((await handler(request())).status).toBe(200);
      expect(mockSend).toHaveBeenLastCalledWith(
        expect.objectContaining({ from })
      );
      await sendReservationConfirmation({ kind, id: 'booking' });
      expect(mockSend).toHaveBeenLastCalledWith(
        expect.objectContaining({ from }),
        { idempotencyKey: `reservation-confirmation:${kind}:booking` }
      );
      expect(mockUpdateOne).toHaveBeenCalledTimes(1);
    });
  }
}
test('invalid sender cannot dispatch or mark a paid confirmation delivered', async () => {
  useRow(100);
  process.env.LODGEFLOW_PAYMENT_EMAIL_FROM = 'bad\r\nBcc: other@example.com';
  await expect(
    sendReservationConfirmation({ kind: 'dining', id: 'booking' })
  ).rejects.toBeInstanceOf(EmailSenderConfigurationError);
  expect((await payment(request())).status).toBe(500);
  expect(mockSend).not.toHaveBeenCalled();
  expect(mockUpdateOne).not.toHaveBeenCalled();
});
test('provider rejection cannot mark delivery; retry preserves idempotency key', async () => {
  useRow(100);
  mockSend.mockResolvedValueOnce({ error: { message: 'provider failure' } });
  await expect(
    sendReservationConfirmation({ kind: 'experience', id: 'booking' })
  ).rejects.toThrow('provider failure');
  expect(mockUpdateOne).not.toHaveBeenCalled();
  await sendReservationConfirmation({ kind: 'experience', id: 'booking' });
  expect(mockUpdateOne).toHaveBeenCalledTimes(1);
  for (const call of mockSend.mock.calls)
    expect(call[1]).toEqual({
      idempotencyKey: 'reservation-confirmation:experience:booking',
    });
});
test('cancellation refund notices use payment sender and report provider failure', async () => {
  const params = {
    booking: {
      customer: 'customer',
      checkInDate: new Date(),
      checkOutDate: new Date(),
      totalPrice: 100,
    },
    cabin: { name: 'Cabin' },
    refundAmount: 100,
    refundType: 'full',
    reason: 'Policy',
  } as const;
  expect((await sendCancellationConfirmationEmail(params)).success).toBe(true);
  expect(mockSend).toHaveBeenLastCalledWith(
    expect.objectContaining({ from: 'LodgeFlow <payments@lodgeflow.app>' })
  );
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockSend.mockResolvedValueOnce({ error: { message: 'provider failure' } });
  expect((await sendCancellationConfirmationEmail(params)).success).toBe(false);
});
