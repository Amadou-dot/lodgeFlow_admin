/** @jest-environment node */
import {
  sendCancellationConfirmationEmail,
  type SendCancellationConfirmationParams,
} from '@/lib/email';

const mockSend = jest.fn();
jest.mock('@/lib/resend', () => ({
  getResend: () => ({ emails: { send: mockSend } }),
}));
jest.mock('@clerk/nextjs/server', () => ({
  clerkClient: async () => ({
    users: {
      getUser: async () => ({
        firstName: 'Avery',
        emailAddresses: [{ emailAddress: 'guest@example.com' }],
      }),
    },
  }),
}));
const params: SendCancellationConfirmationParams = {
  booking: {
    customer: 'guest',
    checkInDate: new Date('2040-01-01'),
    checkOutDate: new Date('2040-01-04'),
    totalPrice: 1234.5,
  },
  cabin: { name: 'Pine' },
  refundAmount: 1.005,
  refundType: 'partial',
  reason: 'Policy',
};
beforeEach(() => {
  mockSend.mockReset().mockResolvedValue({ data: { id: 'message' } });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});

test('cancellation retains fixed ungrouped dollar amounts and existing fractional rounding', async () => {
  expect(await sendCancellationConfirmationEmail(params)).toEqual({
    success: true,
    messageId: 'message',
  });
  expect(mockSend).toHaveBeenCalledWith(
    expect.objectContaining({
      to: 'guest@example.com',
      html: expect.stringContaining(
        'You will receive a partial refund of $1.00.'
      ),
    })
  );
  expect(mockSend).toHaveBeenCalledWith(
    expect.objectContaining({
      html: expect.stringContaining(
        '<strong>Original Total:</strong> $1234.50'
      ),
    })
  );
});

test('invalid refund amounts cannot dispatch a cancellation notice', async () => {
  expect(
    (
      await sendCancellationConfirmationEmail({
        ...params,
        refundAmount: Infinity,
      })
    ).success
  ).toBe(false);
  expect(mockSend).not.toHaveBeenCalled();
});
