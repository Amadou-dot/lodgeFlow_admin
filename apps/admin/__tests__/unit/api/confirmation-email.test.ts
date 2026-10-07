import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';
import { createErrorResponse, requireApiAuth } from '@/lib/api-utils';
import { checkRateLimit } from '@/lib/rate-limit';

const mockAuth = jest.fn<
  ReturnType<typeof requireApiAuth>,
  Parameters<typeof requireApiAuth>
>();
const mockRateLimit = jest.fn<
  ReturnType<typeof checkRateLimit>,
  Parameters<typeof checkRateLimit>
>();
interface EmailInput {
  from: string;
  to: string;
  subject: string;
  react: ReactElement;
}
type SendResult =
  | { data: { id: string }; error: null }
  | { data: null; error: { name: string; message: string } };
const mockSend = jest.fn<Promise<SendResult>, [EmailInput]>();
const mockGetResend = jest.fn(() => ({ emails: { send: mockSend } }));
jest.mock('@clerk/nextjs/server', () => ({ auth: jest.fn() }));
jest.mock('@/lib/staff-access', () => ({ resolveStaffRole: jest.fn() }));
jest.mock('@/lib/api-utils', () => ({
  ...jest.requireActual<typeof import('@/lib/api-utils')>('@/lib/api-utils'),
  requireApiAuth: (...args: Parameters<typeof requireApiAuth>) =>
    mockAuth(...args),
}));
jest.mock('@/lib/rate-limit', () => ({
  ...jest.requireActual<typeof import('@/lib/rate-limit')>('@/lib/rate-limit'),
  checkRateLimit: (...args: Parameters<typeof checkRateLimit>) =>
    mockRateLimit(...args),
}));
jest.mock('@/lib/resend', () => ({ getResend: () => mockGetResend() }));
import { POST } from '@/app/api/send/confirm/route';

const payload = {
  firstName: 'Rae & Finch',
  email: 'UPPER@Example.invalid',
  bookingData: {
    _id: '507f1f77bcf86cd799439011',
    checkInDate: '2040-01-01',
    checkOutDate: '2040-01-03',
    numNights: 2,
    numGuests: 2,
    cabinPrice: 200,
    extrasPrice: 0,
    totalPrice: 400,
    depositAmount: 100,
    remainingAmount: 400,
  },
  cabinData: {
    name: 'Lake & Pine',
    capacity: 4,
    price: 200,
    description: 'Quiet cabin',
    amenities: ['WiFi'],
  },
};
const request = (body: unknown = payload) =>
  new Request('https://admin.test', {
    method: 'POST',
    body: JSON.stringify(body),
  });
beforeEach(() => {
  jest.resetAllMocks();
  mockAuth.mockResolvedValue({
    authenticated: true,
    userId: 'staff',
    role: 'manager',
  });
  mockRateLimit.mockResolvedValue({
    success: true,
    limit: 5,
    remaining: 4,
    resetTime: Date.now() + 30000,
  });
  mockGetResend.mockReturnValue({ emails: { send: mockSend } });
  mockSend.mockResolvedValue({ data: { id: 'email' }, error: null });
});
afterEach(() => jest.restoreAllMocks());
test('retains staff authorization, rate key, sender, recipient, rendered fields and success ID', async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ id: 'email' });
  expect(mockAuth).toHaveBeenCalledWith({ permission: 'bookings:manage' });
  expect(mockRateLimit.mock.calls[0][0]).toBe('staff:send-confirm');
  const input = mockSend.mock.calls[0][0];
  expect(input).toMatchObject({
    to: payload.email,
    from: 'LodgeFlow <notifications@lodgeflow.app>',
    subject: 'Booking Confirmation',
  });
  const html = renderToStaticMarkup(input.react);
  expect(html).toContain('Lake &amp; Pine');
  expect(html).toContain('$400.00');
  expect(html).toContain('WiFi');
});
test('auth and rate denials precede parsing and sending', async () => {
  mockAuth.mockResolvedValueOnce({
    authenticated: false,
    error: createErrorResponse('Denied', 403),
  });
  const input = new Request('https://admin.test', {
    method: 'POST',
    body: '{',
  });
  expect((await POST(input)).status).toBe(403);
  expect(mockRateLimit).not.toHaveBeenCalled();
  mockRateLimit.mockResolvedValueOnce({
    success: false,
    limit: 5,
    remaining: 0,
    resetTime: Date.now() + 30000,
  });
  expect((await POST(input)).status).toBe(429);
  expect(mockSend).not.toHaveBeenCalled();
});
test.each([
  null,
  [],
  { ...payload, email: ['guest@example.invalid'] },
  { ...payload, firstName: {} },
  { ...payload, bookingData: null },
  { ...payload, cabinData: null },
  { ...payload, bookingData: { ...payload.bookingData, checkInDate: 'bad' } },
  { ...payload, cabinData: { ...payload.cabinData, amenities: 'bad' } },
])('invalid confirmation payload is 400 without sending', async body => {
  expect((await POST(request(body))).status).toBe(400);
  expect(mockSend).not.toHaveBeenCalled();
});
test('malformed JSON is 400 without sending', async () => {
  expect(
    (
      await POST(
        new Request('https://admin.test', { method: 'POST', body: '{' })
      )
    ).status
  ).toBe(400);
  expect(mockSend).not.toHaveBeenCalled();
});
test('provider rejection is a safe 500', async () => {
  mockSend.mockResolvedValueOnce({
    data: null,
    error: { name: 'provider', message: 'private detail' },
  });
  const response = await POST(request());
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({
    error: 'Failed to send confirmation email',
  });
});
test('unexpected auth failure is a safe 500', async () => {
  mockAuth.mockRejectedValueOnce(new Error('private auth detail'));
  const response = await POST(request());
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({
    error: 'Failed to send confirmation email',
  });
  expect(mockSend).not.toHaveBeenCalled();
});
