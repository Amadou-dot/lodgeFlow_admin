import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { createTestQueryClient } from '@/__tests__/shared/test-utils';
import { useCreateCheckoutSession } from '@/hooks/usePayment';

const fetchMock = jest.fn();
const bookingId = '507f1f77bcf86cd7994390ab';
const url = 'https://checkout.stripe.invalid/session';
beforeEach(() => {
  jest.resetAllMocks();
  global.fetch = fetchMock;
});

function renderCheckout() {
  const client = createTestQueryClient();
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  const hook = renderHook(() => useCreateCheckoutSession(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  return { ...hook, invalidate };
}

test('sends only the booking ID and refreshes existing payment/history caches', async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, data: { url } }),
  } satisfies Pick<Response, 'ok' | 'json'>);
  const { result, invalidate } = renderCheckout();
  await expect(result.current.mutateAsync(bookingId)).resolves.toEqual({ url });
  expect(fetchMock).toHaveBeenCalledWith('/api/payments/create-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingId }),
  });
  expect(invalidate.mock.calls).toEqual([
    [{ queryKey: ['booking', bookingId] }],
    [{ queryKey: ['payment-status'] }],
    [{ queryKey: ['bookings-history'] }],
  ]);
});

test('keeps caches on denial and retries the same booking successfully', async () => {
  fetchMock.mockResolvedValueOnce({
    ok: false,
    json: async () => ({
      success: false,
      error: 'Booking changed; refresh and try again',
    }),
  } satisfies Pick<Response, 'ok' | 'json'>);
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ success: true, data: { url } }),
  } satisfies Pick<Response, 'ok' | 'json'>);
  const { result, invalidate } = renderCheckout();
  await expect(result.current.mutateAsync(bookingId)).rejects.toThrow(
    'Booking changed; refresh and try again'
  );
  expect(invalidate).not.toHaveBeenCalled();
  await expect(result.current.mutateAsync(bookingId)).resolves.toEqual({ url });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(invalidate).toHaveBeenCalledTimes(3);
});
