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

describe('welcome email hook characterization', () => {
  test('posts without recipient input and returns the provider message ID', async () => {
    fetchMock.mockResolvedValue(
      response({ ok: true, body: { id: 'welcome-message' } })
    );
    const { result } = renderHook(() => useSendWelcomeEmail());
    await expect(result.current.sendWelcomeEmail()).resolves.toEqual({
      id: 'welcome-message',
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/send/welcome', {
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
  });

  test.each([
    { error: { message: 'Private provider detail' } },
    { error: 'Failed to send welcome email' },
  ])('retains the client error for a non-success response (%j)', async body => {
    fetchMock.mockResolvedValue(response({ ok: false, body }));
    const { result } = renderHook(() => useSendWelcomeEmail());
    await expect(result.current.sendWelcomeEmail()).rejects.toThrow(
      'Failed to send welcome email'
    );
  });

  test('retains network rejection without pretending the message was sent', async () => {
    fetchMock.mockRejectedValue(new Error('Network failure'));
    const { result } = renderHook(() => useSendWelcomeEmail());
    await expect(result.current.sendWelcomeEmail()).rejects.toThrow(
      'Network failure'
    );
  });
});
