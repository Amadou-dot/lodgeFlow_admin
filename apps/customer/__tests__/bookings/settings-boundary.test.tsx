import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useSettings } from '@/hooks/useSettings';

const settings = {
  _id: '507f1f77bcf86cd799439011',
  id: '507f1f77bcf86cd799439011',
  singleton: 'global',
  fullAddress: '',
  minBookingLength: 2,
  maxBookingLength: 30,
  maxGuestsPerBooking: 8,
  breakfastPrice: 15,
  checkInTime: '15:00',
  checkOutTime: '11:00',
  cancellationPolicy: 'moderate',
  requireDeposit: true,
  depositPercentage: 25,
  allowPets: true,
  petFee: 20,
  smokingAllowed: false,
  earlyCheckInFee: 50,
  lateCheckOutFee: 50,
  wifiIncluded: true,
  parkingIncluded: false,
  parkingFee: 10,
  currency: 'USD',
  timezone: 'UTC',
  businessHours: {
    open: '09:00',
    close: '18:00',
    daysOpen: [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ],
  },
  notifications: {
    emailEnabled: true,
    smsEnabled: false,
    bookingConfirmation: true,
    paymentReminders: true,
    checkInReminders: true,
  },
};

const originalFetch = global.fetch;
const fetchMock = jest.fn<
  Promise<{ ok: boolean; json: () => Promise<unknown> }>,
  Parameters<typeof fetch>
>();
let client: QueryClient;

function response(body: unknown, ok = true) {
  return { ok, json: async () => body };
}

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  fetchMock.mockReset();
  Object.defineProperty(global, 'fetch', { value: fetchMock, writable: true });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  client.clear();
  global.fetch = originalFetch;
});

test('the booking settings query caches valid customer defaults including absent contact and metadata', async () => {
  fetchMock.mockResolvedValue(response({ success: true, data: settings }));
  const { result } = renderHook(useSettings, { wrapper });

  await waitFor(() => expect(result.current.data).toEqual(settings));
  expect(client.getQueryData(['settings'])).toEqual(settings);
  expect(fetchMock).toHaveBeenCalledWith('/api/settings');
});

test.each([
  [
    'invalid nested settings',
    {
      success: true,
      data: {
        ...settings,
        notifications: { ...settings.notifications, emailEnabled: 1 },
      },
      error: 'private detail',
    },
  ],
  [
    'truthy success marker',
    { success: 'true', data: settings, error: 'private detail' },
  ],
  ['missing data', { success: true, error: 'private detail' }],
])(
  'a customer refetch with %s keeps the last good settings and reports a safe error',
  async (_name, invalid) => {
    fetchMock.mockResolvedValueOnce(
      response({ success: true, data: settings })
    );
    const { result } = renderHook(useSettings, { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(settings));
    expect(result.current.error).toBeNull();

    fetchMock.mockResolvedValueOnce(response(invalid));
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() =>
      expect(result.current.error?.message).toBe('Failed to fetch settings')
    );
    expect(result.current.data).toEqual(settings);
    expect(client.getQueryData(['settings'])).toEqual(settings);
  }
);

test('the customer query keeps the application failure message', async () => {
  fetchMock.mockResolvedValueOnce(
    response({ success: false, error: 'Settings unavailable' })
  );
  const { result } = renderHook(useSettings, { wrapper });
  await waitFor(() =>
    expect(result.current.error?.message).toBe('Settings unavailable')
  );
  expect(result.current.data).toBeUndefined();
});

test('the customer query replaces an invalid JSON parsing error with a safe message', async () => {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => {
      throw new SyntaxError('private detail');
    },
  });
  const { result } = renderHook(useSettings, { wrapper });
  await waitFor(() =>
    expect(result.current.error?.message).toBe('Failed to fetch settings')
  );
  expect(result.current.data).toBeUndefined();
});
