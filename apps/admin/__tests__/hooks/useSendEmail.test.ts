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
    json: async () => ({ id: 'email' }),
  } satisfies Pick<Response, 'ok' | 'json'>);
  const { result } = renderHook(() => useSendConfirmationEmail());
  expect(await result.current.sendConfirmationEmail(payload)).toEqual({
    id: 'email',
  });
  expect(global.fetch).toHaveBeenCalledWith('/api/send/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
});
test.each([
  { error: 'Email service unavailable', expected: 'Email service unavailable' },
  { error: undefined, expected: 'Failed to send confirmation email' },
])('retains error handling: $expected', async ({ error, expected }) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ error }),
  } satisfies Pick<Response, 'ok' | 'json'>);
  const { result } = renderHook(() => useSendConfirmationEmail());
  await expect(result.current.sendConfirmationEmail(payload)).rejects.toThrow(
    expected
  );
});
