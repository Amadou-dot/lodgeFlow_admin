import { renderHook } from '@testing-library/react';
import { useSendConfirmationEmail } from '@/hooks/useSendEmail';
import type { ConfirmationEmailRequest } from '@/lib/validations/confirmation-email';
const payload: ConfirmationEmailRequest = {
  firstName: 'John',
  email: 'john@example.com',
  bookingData: {
    _id: 'booking1',
    checkInDate: '2040-01-01',
    checkOutDate: '2040-01-03',
    numNights: 2,
    numGuests: 2,
    cabinPrice: 100,
    extrasPrice: 0,
    totalPrice: 200,
    depositAmount: 50,
    remainingAmount: 200,
  },
  cabinData: {
    name: 'Lake Cabin',
    capacity: 4,
    price: 100,
    description: 'Quiet cabin',
    amenities: [],
  },
};
beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
});
test('returns a callable confirmation sender', () => {
  const { result } = renderHook(() => useSendConfirmationEmail());
  expect(result.current.sendConfirmationEmail).toBeInstanceOf(Function);
});
test('sends named confirmation data as the existing POST body', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ id: 'mail:opaque/1', metadata: { queued: true } }),
  } satisfies Pick<Response, 'ok' | 'json'>);
  const { result } = renderHook(() => useSendConfirmationEmail());
  expect(await result.current.sendConfirmationEmail(payload)).toEqual({
    id: 'mail:opaque/1',
    metadata: { queued: true },
  });
  expect(global.fetch).toHaveBeenCalledWith('/api/send/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
});
test.each([
  { status: 400, body: { error: 'Invalid JSON body' } },
  { status: 400, body: { error: 'Invalid email address' } },
  { status: 400, body: { error: 'Missing booking or cabin data' } },
  { status: 400, body: { error: 'Invalid confirmation email data' } },
  { status: 401, body: { success: false, error: 'Unauthorized' } },
  { status: 401, body: { success: false, error: 'Authentication failed' } },
  {
    status: 403,
    body: { success: false, error: 'Forbidden: Insufficient permissions' },
  },
  {
    status: 429,
    body: {
      success: false,
      error: 'Too many requests. Please try again later.',
      retryAfter: 30,
    },
  },
  { status: 500, body: { error: 'Failed to send confirmation email' } },
])('retains the API error from $status $body', async ({ status, body }) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => body,
  } satisfies Pick<Response, 'ok' | 'status' | 'json'>);
  const { result } = renderHook(() => useSendConfirmationEmail());
  await expect(result.current.sendConfirmationEmail(payload)).rejects.toThrow(
    body.error
  );
});

test.each([
  null,
  {},
  { id: 42 },
  { error: { message: 'Private provider details' } },
  { error: '   ' },
])(
  'uses the confirmation fallback for an unusable error body %j',
  async body => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => body,
    } satisfies Pick<Response, 'ok' | 'json'>);
    const { result } = renderHook(() => useSendConfirmationEmail());
    await expect(result.current.sendConfirmationEmail(payload)).rejects.toThrow(
      'Failed to send confirmation email'
    );
  }
);

test.each([
  null,
  {},
  { id: 42 },
  { data: { id: 'mail:opaque/1' }, error: null },
  { error: 'Unverified error in a 200 response' },
])('rejects malformed success %j without resending', async body => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => body,
  } satisfies Pick<Response, 'ok' | 'json'>);
  const { result } = renderHook(() => useSendConfirmationEmail());
  await expect(result.current.sendConfirmationEmail(payload)).rejects.toThrow(
    'Failed to send confirmation email'
  );
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test.each([true, false])(
  'uses the confirmation fallback for invalid JSON (ok=%s)',
  async ok => {
    global.fetch = jest.fn().mockResolvedValue({
      ok,
      json: async () => JSON.parse('<html>Gateway response</html>'),
    } satisfies Pick<Response, 'ok' | 'json'>);
    const { result } = renderHook(() => useSendConfirmationEmail());
    await expect(result.current.sendConfirmationEmail(payload)).rejects.toThrow(
      'Failed to send confirmation email'
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  }
);

test.each([{ remainingAmount: null }, { extras: { hasBreakfast: true } }])(
  'rejects incomplete lean booking fields before sending',
  async fields => {
    const { result } = renderHook(() => useSendConfirmationEmail());
    await expect(
      result.current.sendConfirmationEmail({
        ...payload,
        bookingData: { ...payload.bookingData, ...fields },
      })
    ).rejects.toThrow();
    expect(global.fetch).not.toHaveBeenCalled();
  }
);
