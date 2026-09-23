/** @jest-environment node */
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Types } from 'mongoose';

const mockAuth = jest.fn<Promise<{ userId: string | null }>, []>();
const mockCurrentUser = jest.fn();
const mockPopulate = jest.fn();
const mockSend = jest.fn<
  Promise<{ data?: { id: string }; error?: { message: string } }>,
  [{ react: ReactNode; from: string; to: string; subject: string }]
>();
jest.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
  currentUser: () => mockCurrentUser(),
}));
jest.mock('@lodgeflow/database', () => ({
  connectDB: jest.fn(),
  Booking: { findById: jest.fn(() => ({ populate: mockPopulate })) },
}));
jest.mock('@/lib/resend', () => ({
  getResend: () => ({ emails: { send: mockSend } }),
}));
import { POST } from '@/app/api/send/payment-confirm/route';
import { Booking, connectDB } from '@lodgeflow/database';

function booking() {
  return {
    _id: new Types.ObjectId('507f1f77bcf86cd7994390ab'),
    customer: 'customer',
    cabin: { name: 'Pine Cabin' },
    checkInDate: new Date('2030-06-03T15:00:00Z'),
    checkOutDate: new Date('2030-06-05T15:00:00Z'),
    totalPrice: 300.5,
    isPaid: false,
    remainingAmount: 225.25,
    payments: [{ amount: 75.25 }],
  };
}
function request(body: object = { bookingId: booking()._id.toHexString() }) {
  return new Request('http://localhost/api/send/payment-confirm', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
function emailText() {
  return renderToStaticMarkup(mockSend.mock.calls[0][0].react).replace(
    /<[^>]+>/g,
    ''
  );
}
const originalSender = process.env.LODGEFLOW_PAYMENT_EMAIL_FROM;
beforeEach(() => {
  jest.resetAllMocks();
  delete process.env.LODGEFLOW_PAYMENT_EMAIL_FROM;
  (Booking.findById as jest.Mock).mockReturnValue({ populate: mockPopulate });
  mockAuth.mockResolvedValue({ userId: 'customer' });
  mockCurrentUser.mockResolvedValue({
    firstName: 'Avery',
    emailAddresses: [
      { emailAddress: 'guest@example.com' },
      { emailAddress: 'second@example.com' },
    ],
  });
  mockPopulate.mockResolvedValue(booking());
  mockSend.mockResolvedValue({ data: { id: 'message' } });
});
afterEach(() => {
  if (originalSender === undefined)
    delete process.env.LODGEFLOW_PAYMENT_EMAIL_FROM;
  else process.env.LODGEFLOW_PAYMENT_EMAIL_FROM = originalSender;
});

test('renders the latest receipt in major units with the existing deposit summary', async () => {
  const response = await POST(
    request({
      bookingId: booking()._id.toHexString(),
      amountPaid: 999,
      isDeposit: false,
    })
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ id: 'message' });
  expect(mockSend).toHaveBeenCalledWith(
    expect.objectContaining({
      from: 'LodgeFlow <payments@lodgeflow.app>',
      to: 'guest@example.com',
      subject: 'Payment Confirmation - LodgeFlow',
    })
  );
  const text = emailText();
  expect(text).toContain('Thank you for your payment, Avery!');
  expect(text).toContain('Amount Paid:$75.25');
  expect(text).toContain('Payment Type:Deposit');
  expect(text).toContain('Remaining Balance:$225.25');
  expect(text).toContain('Booking ID:#994390AB');
  expect(text).toContain('Cabin:Pine Cabin');
  expect(text).toContain('Check-in:Monday, June 3, 2030');
  expect(text).toContain('Check-out:Wednesday, June 5, 2030');
  expect(text).toContain('Total Price:$300.50');
});

test('paid bookings render full payment and omit remaining balance', async () => {
  mockPopulate.mockResolvedValue({ ...booking(), isPaid: true });
  mockCurrentUser.mockResolvedValue({
    emailAddresses: [{ emailAddress: 'guest@example.com' }],
  });
  expect((await POST(request())).status).toBe(200);
  expect(emailText()).toContain('Thank you for your payment, Guest!');
  expect(emailText()).toContain('Payment Type:Full Payment');
  expect(emailText()).not.toContain('Remaining Balance:');
});

test('reports the balance after all receipts while displaying the latest amount paid', async () => {
  mockPopulate.mockResolvedValue({
    ...booking(),
    payments: [{ amount: 25 }, { amount: 75.25 }],
    remainingAmount: 200.25,
  });
  expect((await POST(request())).status).toBe(200);
  expect(emailText()).toContain('Amount Paid:$75.25');
  expect(emailText()).toContain('Remaining Balance:$200.25');
});

test('reports a missing cabin before rendering or dispatching email', async () => {
  mockPopulate.mockResolvedValue({ ...booking(), cabin: null });
  const response = await POST(request());
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: 'Cabin not found' });
  expect(mockSend).not.toHaveBeenCalled();
});

test('rejects unauthenticated requests before database access', async () => {
  mockAuth.mockResolvedValue({ userId: null });
  const response = await POST(request());
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: 'Authentication required' });
  expect(connectDB).not.toHaveBeenCalled();
  expect(mockSend).not.toHaveBeenCalled();
});

test('rejects a missing booking ID without database access', async () => {
  const response = await POST(request({}));
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: 'Booking ID is required' });
  expect(connectDB).not.toHaveBeenCalled();
  expect(mockSend).not.toHaveBeenCalled();
});

test.each([
  { row: null, status: 404, error: 'Booking not found' },
  {
    row: { ...booking(), customer: 'foreign' },
    status: 403,
    error: 'Not authorized to send this confirmation',
  },
])('preserves booking denial: $status', async ({ row, status, error }) => {
  mockPopulate.mockResolvedValue(row);
  const response = await POST(request());
  expect(response.status).toBe(status);
  expect(await response.json()).toEqual({ error });
  expect(mockCurrentUser).not.toHaveBeenCalled();
  expect(mockSend).not.toHaveBeenCalled();
});

test.each([undefined, 'invalid'])(
  'rejects unusable recipient %s before sending',
  async emailAddress => {
    mockCurrentUser.mockResolvedValue({ emailAddresses: [{ emailAddress }] });
    const response = await POST(request());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid email address' });
    expect(mockSend).not.toHaveBeenCalled();
  }
);

test('requires a receipt, regardless of deposit obligation or paid flag', async () => {
  mockPopulate.mockResolvedValue({
    ...booking(),
    isPaid: true,
    depositAmount: 100,
    payments: [],
  });
  const response = await POST(request());
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({
    error: 'No payment has been received',
  });
  expect(mockSend).not.toHaveBeenCalled();
});

test('provider rejection and exceptions return failure without changing the booking', async () => {
  const row = booking();
  const before = JSON.stringify(row);
  mockPopulate.mockResolvedValue(row);
  mockSend.mockResolvedValueOnce({
    error: { message: 'Provider unavailable' },
  });
  expect((await POST(request())).status).toBe(500);
  mockSend.mockRejectedValueOnce(new Error('Transport unavailable'));
  expect((await POST(request())).status).toBe(500);
  expect(JSON.stringify(row)).toBe(before);
});
