import { renderHook } from '@testing-library/react';
import { useSendWelcomeEmail } from '@/hooks/useSendEmail';

const fetchMock = jest.fn();
const originalFetch = global.fetch;
function response({ ok, body }: { ok: boolean; body: unknown }) {
  return { ok, json: async () => body } satisfies Pick<Response, 'ok' | 'json'>;
}
beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
});
afterEach(() => {
  global.fetch = originalFetch;
});

describe('admin welcome hook characterization', () => {
  test('posts the recipient/name without changing case and returns the message ID', async () => {
    fetchMock.mockResolvedValue(
      response({ ok: true, body: { id: 'admin-welcome' } })
    );
    const { result } = renderHook(() => useSendWelcomeEmail());
    await expect(
      result.current.sendWelcomeEmail({
        firstName: 'Rae & Finch',
        email: 'UPPER@Example.invalid',
      })
    ).resolves.toEqual({ id: 'admin-welcome' });
    expect(fetchMock).toHaveBeenCalledWith('/api/send/welcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Rae & Finch',
        email: 'UPPER@Example.invalid',
      }),
    });
  });

  test.each([
    { error: { message: 'Private provider detail' } },
    { error: 'Failed to send welcome email' },
  ])('preserves the generic client failure for %j', async body => {
    fetchMock.mockResolvedValue(response({ ok: false, body }));
    const { result } = renderHook(() => useSendWelcomeEmail());
    await expect(
      result.current.sendWelcomeEmail({
        firstName: 'Rae',
        email: 'guest@example.invalid',
      })
    ).rejects.toThrow('Failed to send welcome email');
  });

  test('retains network failure without returning false success', async () => {
    fetchMock.mockRejectedValue(new Error('Network failure'));
    const { result } = renderHook(() => useSendWelcomeEmail());
    await expect(
      result.current.sendWelcomeEmail({
        firstName: 'Rae',
        email: 'guest@example.invalid',
      })
    ).rejects.toThrow('Network failure');
  });
});
