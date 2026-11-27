import { QueryClientProvider } from '@tanstack/react-query';
import { addToast } from '@heroui/toast';
import {
  createTestQueryClient,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@/__tests__/shared/test-utils';
import {
  FetchResponse,
  checkoutApiErrors,
  checkoutUrl,
  invalidCheckoutResponses,
  localCheckoutUrl,
} from '@/__tests__/shared/checkout-failure-fixtures';
import PaymentButton from '@/components/PaymentButton';
import { useCreateCheckoutSession } from '@/hooks/usePayment';

jest.mock('@heroui/toast', () => ({ addToast: jest.fn() }));
jest.mock('@heroui/button', () => ({
  Button: ({
    children,
    onPress,
  }: {
    children: React.ReactNode;
    onPress: () => void;
  }) => <button onClick={onPress}>{children}</button>,
}));

const fetchMock = jest.mocked(fetch);
const bookingId = '507f1f77bcf86cd7994390ab';
const fallback = 'Failed to create checkout session';
const requestOptions = {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ bookingId }),
};

beforeEach(() => jest.resetAllMocks());

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

test.each([checkoutUrl, localCheckoutUrl])(
  'keeps the checkout data and refreshes payment/history caches for %s',
  async url => {
    const data = { url, expiresAt: '2030-01-01T12:00:00.000Z' };
    fetchMock.mockResolvedValue(FetchResponse.json({ success: true, data }));
    const { result, invalidate } = renderCheckout();
    await expect(result.current.mutateAsync(bookingId)).resolves.toEqual(data);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/payments/create-checkout',
      requestOptions
    );
    expect(invalidate.mock.calls).toEqual([
      [{ queryKey: ['booking', bookingId] }],
      [{ queryKey: ['payment-status'] }],
      [{ queryKey: ['bookings-history'] }],
    ]);
  }
);

test.each(invalidCheckoutResponses)(
  'keeps caches on $name and reports the checkout fallback',
  async ({ status, body, headers }) => {
    fetchMock.mockResolvedValue(new FetchResponse(body, { status, headers }));
    const { result, invalidate } = renderCheckout();
    await expect(result.current.mutateAsync(bookingId)).rejects.toMatchObject({
      message: fallback,
    });
    expect(invalidate).not.toHaveBeenCalled();
  }
);

test.each(checkoutApiErrors)(
  'preserves a structured API error ($status) and allows retry',
  async ({ status, body, message }) => {
    fetchMock.mockResolvedValueOnce(new FetchResponse(body, { status }));
    fetchMock.mockResolvedValueOnce(
      FetchResponse.json({ success: true, data: { url: checkoutUrl } })
    );
    const { result, invalidate } = renderCheckout();
    await expect(result.current.mutateAsync(bookingId)).rejects.toMatchObject({
      message,
    });
    expect(invalidate).not.toHaveBeenCalled();
    await expect(result.current.mutateAsync(bookingId)).resolves.toEqual({
      url: checkoutUrl,
    });
    expect(fetchMock.mock.calls).toEqual([
      ['/api/payments/create-checkout', requestOptions],
      ['/api/payments/create-checkout', requestOptions],
    ]);
    expect(invalidate).toHaveBeenCalledTimes(3);
  }
);

test('shows the safe message when cabin checkout receives a sign-in page', async () => {
  fetchMock.mockResolvedValue(
    new FetchResponse('<html>Sign in</html>', {
      headers: { 'Content-Type': 'text/html' },
    })
  );
  render(<PaymentButton amount={75} bookingId={bookingId} isDeposit />);
  fireEvent.click(screen.getByRole('button', { name: 'Pay Deposit ($75)' }));
  await waitFor(() =>
    expect(addToast).toHaveBeenCalledWith({
      title: 'Payment Error',
      description: fallback,
      color: 'danger',
    })
  );
});
