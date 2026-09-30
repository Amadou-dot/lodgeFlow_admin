import { renderHook } from '@testing-library/react';
import { useSendConfirmationEmail } from '@/hooks/useSendEmail';

const fetchMock = jest.fn();
beforeEach(() => {
  jest.resetAllMocks();
  global.fetch = fetchMock;
});

test('sends only the booking ID and retains the successful provider response', async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ id: 'message' }),
  });
  const { result } = renderHook(() => useSendConfirmationEmail());
  await expect(
    result.current.sendConfirmationEmail('507f1f77bcf86cd7994390ab')
  ).resolves.toEqual({ id: 'message' });
  expect(fetchMock).toHaveBeenCalledWith('/api/send/confirm', {
    body: JSON.stringify({ bookingId: '507f1f77bcf86cd7994390ab' }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
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
  await expect(
    result.current.sendConfirmationEmail('507f1f77bcf86cd7994390ab')
  ).rejects.toThrow('Failed to send confirmation email');
  await expect(
    result.current.sendConfirmationEmail('507f1f77bcf86cd7994390ab')
  ).resolves.toEqual({ id: 'retry' });
});
