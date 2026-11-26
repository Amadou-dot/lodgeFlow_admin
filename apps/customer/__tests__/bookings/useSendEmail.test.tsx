import { renderHook } from '@testing-library/react';
import { useSendConfirmationEmail } from '@/hooks/useSendEmail';

const bookingId = '507f1f77bcf86cd7994390ab';
const fetchMock = jest.fn();
const originalFetch = global.fetch;
beforeEach(() => {
  jest.resetAllMocks();
  global.fetch = fetchMock;
});
afterEach(() => {
  global.fetch = originalFetch;
});

test('sends only the booking ID and retains the successful provider response', async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ id: 'mail:opaque/1', metadata: { queued: true } }),
  });
  const { result } = renderHook(() => useSendConfirmationEmail());
  await expect(
    result.current.sendConfirmationEmail(bookingId)
  ).resolves.toEqual({ id: 'mail:opaque/1', metadata: { queued: true } });
  expect(fetchMock).toHaveBeenCalledWith('/api/send/confirm', {
    body: JSON.stringify({ bookingId: '507f1f77bcf86cd7994390ab' }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
});

test('returns the original parsed provider response and all its own fields', async () => {
  const body: unknown = JSON.parse(
    '{"id":"mail:opaque/1","__proto__":{"state":"queued"},"metadata":{"queued":true}}'
  );
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => body,
  } satisfies Pick<Response, 'ok' | 'json'>);
  const { result } = renderHook(() => useSendConfirmationEmail());
  const sent = await result.current.sendConfirmationEmail(bookingId);
  expect(Object.prototype.hasOwnProperty.call(sent, '__proto__')).toBe(true);
  expect(sent).toBe(body);
});

test('surfaces safe route errors and can retry successfully', async () => {
  fetchMock.mockResolvedValueOnce({
    ok: false,
    json: async () => ({ error: 'Failed to send confirmation email' }),
  });
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ id: 'retry' }),
  });
  const { result } = renderHook(() => useSendConfirmationEmail());
  await expect(result.current.sendConfirmationEmail(bookingId)).rejects.toThrow(
    'Failed to send confirmation email'
  );
  await expect(
    result.current.sendConfirmationEmail(bookingId)
  ).resolves.toEqual({ id: 'retry' });
});

test.each([
  [400, 'Invalid JSON body'],
  [400, 'Invalid request body'],
  [400, 'Booking ID is required'],
  [400, 'Invalid booking ID'],
  [400, 'Invalid email address'],
  [401, 'Authentication required'],
  [403, 'Not authorized to send this confirmation'],
  [404, 'Booking not found'],
  [404, 'Cabin not found'],
])('retains the safe error for %i %s', async (status, error) => {
  fetchMock.mockResolvedValue({
    ok: false,
    status,
    json: async () => ({ error }),
  } satisfies Pick<Response, 'ok' | 'status' | 'json'>);
  const { result } = renderHook(() => useSendConfirmationEmail());
  await expect(result.current.sendConfirmationEmail(bookingId)).rejects.toThrow(
    error
  );
});

test.each([null, {}, { error: ['private detail'] }, { error: '   ' }])(
  'uses the confirmation fallback for an unusable error body %j',
  async body => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => body,
    } satisfies Pick<Response, 'ok' | 'json'>);
    const { result } = renderHook(() => useSendConfirmationEmail());
    await expect(
      result.current.sendConfirmationEmail(bookingId)
    ).rejects.toThrow('Failed to send confirmation email');
  }
);

test.each([
  null,
  {},
  { id: 42 },
  { data: { id: 'mail:opaque/1' }, error: null },
  { error: 'Unverified error in a 200 response' },
])('rejects malformed success %j without resending', async body => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => body,
  } satisfies Pick<Response, 'ok' | 'json'>);
  const { result } = renderHook(() => useSendConfirmationEmail());
  await expect(result.current.sendConfirmationEmail(bookingId)).rejects.toThrow(
    'Failed to send confirmation email'
  );
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test.each([true, false])(
  'uses the confirmation fallback for invalid JSON (ok=%s)',
  async ok => {
    fetchMock.mockResolvedValue({
      ok,
      json: async () => JSON.parse('<html>Gateway response</html>'),
    } satisfies Pick<Response, 'ok' | 'json'>);
    const { result } = renderHook(() => useSendConfirmationEmail());
    await expect(
      result.current.sendConfirmationEmail(bookingId)
    ).rejects.toThrow('Failed to send confirmation email');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  }
);
