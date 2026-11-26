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
    checkInDate: '2040-01-01T00:00:00.000Z',
    checkOutDate: '2040-01-03T00:00:00.000Z',
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
  const providerData = { id: 'email', metadata: { queued: true } };
  mockSend.mockResolvedValueOnce({ data: providerData, error: null });
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    id: 'email',
    metadata: { queued: true },
  });
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
  expect(html).toContain('Sunday, January 1, 2040');
  expect(html).toContain('Tuesday, January 3, 2040');
});
async function renderConfirmation({
  checkInDate,
  checkOutDate,
}: Pick<typeof payload.bookingData, 'checkInDate' | 'checkOutDate'>) {
  const response = await POST(
    request({
      ...payload,
      bookingData: { ...payload.bookingData, checkInDate, checkOutDate },
    })
  );
  expect(response.status).toBe(200);
  return renderToStaticMarkup(mockSend.mock.calls[0][0].react);
}

test.each([
  {
    form: 'offset-free ISO date-times',
    checkInDate: '2027-03-20T23:30:00',
    checkOutDate: '2027-03-23T00:30:00',
  },
  {
    form: 'legacy numeric and written date-times',
    checkInDate: '03/20/2027 23:30:00',
    checkOutDate: 'March 23, 2027 00:30:00',
  },
  {
    form: 'ISO and legacy date-only strings',
    checkInDate: '2027-03-20',
    checkOutDate: '03-23-2027',
  },
  {
    form: 'legacy date-times with comments',
    checkInDate: 'March 20, 2027 23:30:00 ((local) UTC)',
    checkOutDate: 'March 23, 2027 00:30:00 (local time)',
  },
  {
    form: 'written dates with hyphen separators',
    checkInDate: 'March -20 2027 23:30:00',
    checkOutDate: 'March -23 2027 00:30:00',
  },
  {
    form: 'legacy dates with an ignored leading zone name',
    checkInDate: 'UTC Mar 20 2027 23:30',
    checkOutDate: 'UTC Mar 23 2027 00:30',
  },
])(
  'preserves the stated calendar days for $form',
  async ({ checkInDate, checkOutDate }) => {
    const html = await renderConfirmation({ checkInDate, checkOutDate });
    expect(html).toContain('Saturday, March 20, 2027');
    expect(html).toContain('Tuesday, March 23, 2027');
  }
);

test('renders ISO date-times with numeric offsets on their UTC calendar days', async () => {
  const html = await renderConfirmation({
    checkInDate: '2027-03-20T23:30:00-06:00',
    checkOutDate: '2027-03-23T00:30:00+0900',
  });
  expect(html).toContain('Sunday, March 21, 2027');
  expect(html).toContain('Monday, March 22, 2027');
});

test.each([
  {
    form: 'legacy named zones',
    checkInDate: 'Sat, 20 Mar 2027 23:30:00 MST',
    checkOutDate: 'Tue Mar 23 2027 00:30:00 GMT+0900 (Japan Standard Time)',
  },
  {
    form: 'legacy numeric offsets',
    checkInDate: 'Mar 20 2027 11:30 pm-0600',
    checkOutDate: '00:30:00 03-23-2027 +0900',
  },
  {
    form: 'legacy negative-zero year',
    checkInDate: '-000000-03-20',
    checkOutDate: '-000000-03-23',
  },
])(
  'preserves the original local-calendar presentation for $form',
  async ({ checkInDate, checkOutDate }) => {
    const html = await renderConfirmation({ checkInDate, checkOutDate });
    const legacyCalendarLabel = (date: string) =>
      new Date(date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    expect(html).toContain(legacyCalendarLabel(checkInDate));
    expect(html).toContain(legacyCalendarLabel(checkOutDate));
  }
);

test('auth and rate denials precede parsing and sending', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
  mockAuth.mockResolvedValueOnce({
    authenticated: false,
    error: createErrorResponse('Forbidden: Insufficient permissions', 403),
  });
  const input = new Request('https://admin.test', {
    method: 'POST',
    body: '{',
  });
  const denied = await POST(input);
  expect(denied.status).toBe(403);
  expect(await denied.json()).toEqual({
    success: false,
    error: 'Forbidden: Insufficient permissions',
  });
  expect(mockRateLimit).not.toHaveBeenCalled();
  mockRateLimit.mockResolvedValueOnce({
    success: false,
    limit: 5,
    remaining: 0,
    resetTime: Date.now() + 30000,
  });
  const throttled = await POST(input);
  expect(throttled.status).toBe(429);
  expect(await throttled.json()).toEqual({
    success: false,
    error: 'Too many requests. Please try again later.',
    retryAfter: 30,
  });
  expect(throttled.headers.get('Retry-After')).toBe('30');
  expect(throttled.headers.get('X-RateLimit-Reset')).toBe('1700000030000');
  expect(mockSend).not.toHaveBeenCalled();
});
test.each([
  { body: null, error: 'Invalid confirmation email data' },
  { body: [], error: 'Missing booking or cabin data' },
  {
    body: { ...payload, email: ['guest@example.invalid'] },
    error: 'Invalid email address',
  },
  {
    body: { ...payload, firstName: {} },
    error: 'Invalid confirmation email data',
  },
  {
    body: { ...payload, bookingData: null },
    error: 'Missing booking or cabin data',
  },
  {
    body: { ...payload, cabinData: null },
    error: 'Missing booking or cabin data',
  },
  {
    body: {
      ...payload,
      bookingData: { ...payload.bookingData, checkInDate: 'bad' },
    },
    error: 'Invalid confirmation email data',
  },
  {
    body: { ...payload, cabinData: { ...payload.cabinData, amenities: 'bad' } },
    error: 'Invalid confirmation email data',
  },
])(
  'returns 400 $error for invalid confirmation data',
  async ({ body, error }) => {
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error });
    expect(mockSend).not.toHaveBeenCalled();
  }
);
test('malformed JSON is 400 without sending', async () => {
  const response = await POST(
    new Request('https://admin.test', { method: 'POST', body: '{' })
  );
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: 'Invalid JSON body' });
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
