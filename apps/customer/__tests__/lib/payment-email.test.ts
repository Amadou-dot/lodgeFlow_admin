/** @jest-environment node */
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Types } from 'mongoose';
import type { SendPaymentConfirmationParams } from '@/lib/email';

const mockGetUser = jest.fn();
const mockSend = jest.fn<
  Promise<{ data?: { id: string }; error?: { message: string } }>,
  [{ react: ReactNode; from: string; to: string; subject: string }]
>();
jest.mock('@clerk/nextjs/server', () => ({
  clerkClient: async () => ({ users: { getUser: mockGetUser } }),
}));
jest.mock('@/lib/resend', () => ({
  getResend: () => ({ emails: { send: mockSend } }),
}));
import { sendPaymentConfirmationEmail } from '@/lib/email';
import { serializePaymentEmailBooking } from '@/lib/serializers/payment-email';

const source = {
  _id: new Types.ObjectId('507f1f77bcf86cd7994390ab'),
  customer: 'customer',
  checkInDate: new Date('2030-06-03T09:00:00-06:00'),
  checkOutDate: new Date('2030-06-05T09:00:00-06:00'),
  totalPrice: 300.5,
  remainingAmount: 200.25,
  checkoutToken: 'private-quote',
  observations: 'private-note',
};
const params = {
  booking: serializePaymentEmailBooking(source),
  cabin: { name: 'Pine Cabin' },
  amountPaid: 75.25,
  isDeposit: true,
} satisfies SendPaymentConfirmationParams;

const originalSender = process.env.LODGEFLOW_PAYMENT_EMAIL_FROM;
beforeEach(() => {
  jest.resetAllMocks();
  delete process.env.LODGEFLOW_PAYMENT_EMAIL_FROM;
  mockGetUser.mockResolvedValue({
    firstName: 'Avery',
    emailAddresses: [
      { emailAddress: 'guest@example.com' },
      { emailAddress: 'second@example.com' },
    ],
  });
  mockSend.mockResolvedValue({ data: { id: 'message' } });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  if (originalSender === undefined)
    delete process.env.LODGEFLOW_PAYMENT_EMAIL_FROM;
  else process.env.LODGEFLOW_PAYMENT_EMAIL_FROM = originalSender;
  jest.restoreAllMocks();
});

test('serializes only email fields with string identity and unchanged instants/amounts', () => {
  expect(serializePaymentEmailBooking(source)).toEqual({
    _id: '507f1f77bcf86cd7994390ab',
    customer: 'customer',
    checkInDate: '2030-06-03T15:00:00.000Z',
    checkOutDate: '2030-06-05T15:00:00.000Z',
    totalPrice: 300.5,
    remainingAmount: 200.25,
  });
});

test('renders the narrow settlement input with the existing cabin subject and customer recipient', async () => {
  expect(await sendPaymentConfirmationEmail(params)).toEqual({
    success: true,
    messageId: 'message',
  });
  expect(mockGetUser).toHaveBeenCalledWith('customer');
  const input = mockSend.mock.calls[0][0];
  expect(input).toEqual(
    expect.objectContaining({
      from: 'LodgeFlow <payments@lodgeflow.app>',
      to: 'guest@example.com',
      subject: 'Payment Confirmation - Pine Cabin',
    })
  );
  const text = renderToStaticMarkup(input.react).replace(/<[^>]+>/g, '');
  expect(text).toContain('Thank you for your payment, Avery!');
  expect(text).toContain('Booking ID:#994390AB');
  expect(text).toContain('Amount Paid:$75.25');
  expect(text).toContain('Payment Type:Deposit');
  expect(text).toContain('Remaining Balance:$200.25');
  expect(text).toContain('Check-in:Monday, June 3, 2030');
  expect(text).toContain('Check-out:Wednesday, June 5, 2030');
});

test('retains the Guest fallback and full-payment presentation', async () => {
  mockGetUser.mockResolvedValue({
    emailAddresses: [{ emailAddress: 'guest@example.com' }],
  });
  await sendPaymentConfirmationEmail({ ...params, isDeposit: false });
  const text = renderToStaticMarkup(mockSend.mock.calls[0][0].react).replace(
    /<[^>]+>/g,
    ''
  );
  expect(text).toContain('Thank you for your payment, Guest!');
  expect(text).toContain('Payment Type:Full Payment');
  expect(text).not.toContain('Remaining Balance:');
});

test.each([
  { emailAddresses: [] },
  { emailAddresses: [{ emailAddress: 'invalid' }] },
])(
  'does not dispatch to an unusable recipient: %j',
  async ({ emailAddresses }) => {
    mockGetUser.mockResolvedValue({ emailAddresses });
    expect(await sendPaymentConfirmationEmail(params)).toEqual({
      success: false,
      error: 'Invalid or missing email address for customer',
    });
    expect(mockSend).not.toHaveBeenCalled();
  }
);

test('reports provider rejection and thrown delivery failures without claiming success', async () => {
  mockSend.mockResolvedValueOnce({
    error: { message: 'Provider unavailable' },
  });
  expect(await sendPaymentConfirmationEmail(params)).toEqual({
    success: false,
    error: 'Provider unavailable',
  });
  mockSend.mockRejectedValueOnce(new Error('Transport unavailable'));
  expect(await sendPaymentConfirmationEmail(params)).toEqual({
    success: false,
    error: 'Transport unavailable',
  });
});

test('Clerk lookup failure cannot dispatch a message', async () => {
  mockGetUser.mockRejectedValueOnce(new Error('Identity unavailable'));
  expect(await sendPaymentConfirmationEmail(params)).toEqual({
    success: false,
    error: 'Identity unavailable',
  });
  expect(mockSend).not.toHaveBeenCalled();
});

test('invalid sender configuration cannot dispatch a message', async () => {
  process.env.LODGEFLOW_PAYMENT_EMAIL_FROM = '';
  expect((await sendPaymentConfirmationEmail(params)).success).toBe(false);
  expect(mockSend).not.toHaveBeenCalled();
});
