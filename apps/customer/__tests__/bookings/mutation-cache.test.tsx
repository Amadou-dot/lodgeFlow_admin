import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import useSWR, { SWRConfig } from 'swr';
import { useCancelBooking, useCreateBooking } from '@/hooks/useBooking';
import {
  useCancelDiningReservation,
  useCreateDiningReservation,
} from '@/hooks/useDiningReservation';
import {
  useCancelExperienceBooking,
  useCreateExperienceBooking,
} from '@/hooks/useExperienceBooking';
import { useCreateCheckoutSession } from '@/hooks/usePayment';

function setup() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  const swrCache = new Map();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <SWRConfig value={{ provider: () => swrCache, dedupingInterval: 0 }}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </SWRConfig>
  );
  return { client, wrapper };
}
function seed(client: QueryClient, keys: readonly (readonly string[])[]) {
  for (const queryKey of keys) client.setQueryData(queryKey, { isPaid: false });
}
function expectStale(
  client: QueryClient,
  keys: readonly (readonly string[])[]
) {
  for (const queryKey of keys)
    expect(client.getQueryState(queryKey)?.isInvalidated).toBe(true);
}
beforeEach(() => {
  jest.mocked(fetch).mockReset();
});
test.each(['create', 'cancel'] as const)(
  'cabin %s refreshes both actual SWR availability and TanStack preview',
  async action => {
    const { client, wrapper } = setup();
    const keys = [
      ['cabin-availability', 'cabin'],
      ['bookings-history'],
      ...(action === 'cancel' ? [['booking', 'booking']] : []),
    ];
    seed(client, keys);
    let available = 1;
    const readAvailability = jest.fn(async () => ({ available }));
    jest.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: {} }),
    } as Response);
    const { result } = renderHook(
      () => ({
        availability: useSWR(
          '/api/cabins/cabin/availability',
          readAvailability
        ),
        create: useCreateBooking(),
        cancel: useCancelBooking(),
      }),
      { wrapper }
    );
    await waitFor(() =>
      expect(result.current.availability.data?.available).toBe(1)
    );
    available = 2;
    await act(async () => {
      if (action === 'create')
        await result.current.create.mutateAsync({
          cabinId: 'cabin',
          checkInDate: '2030-06-01',
          checkOutDate: '2030-06-03',
          numGuests: 2,
        });
      else await result.current.cancel.mutateAsync({ bookingId: 'booking' });
    });
    expectStale(client, keys);
    await waitFor(() =>
      expect(result.current.availability.data?.available).toBe(2)
    );
  }
);
test.each(['dining', 'experience'] as const)(
  '%s cancellation invalidates the matching detail and all history variants',
  async kind => {
    const { client, wrapper } = setup();
    const keys =
      kind === 'dining'
        ? [
            ['dining-reservation', 'record'],
            ['dining-reservations-history', 'confirmed'],
            ['dining-availability', 'listing', '2030-06-01', '19:00'],
          ]
        : [
            ['experience-booking', 'record'],
            ['experience-bookings-history', 'confirmed'],
          ];
    seed(client, keys);
    jest.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: {} }),
    } as Response);
    const { result } = renderHook(
      () => ({
        dining: useCancelDiningReservation(),
        experience: useCancelExperienceBooking(),
      }),
      { wrapper }
    );
    await act(async () => {
      await result.current[kind].mutateAsync('record');
    });
    expectStale(client, keys);
  }
);
test('dining creation invalidates existing availability variants', async () => {
  const { client, wrapper } = setup();
  const keys = [['dining-availability', 'listing', '2030-06-01', '19:00']];
  seed(client, keys);
  jest.mocked(fetch).mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, data: {} }),
  } as Response);
  const { result } = renderHook(() => useCreateDiningReservation(), {
    wrapper,
  });
  await act(async () => {
    await result.current.mutateAsync({
      diningId: 'listing',
      date: '2030-06-01',
      time: '19:00',
      numGuests: 2,
    });
  });
  expectStale(client, keys);
});
test('checkout refreshes detail without fabricating settlement', async () => {
  const { client, wrapper } = setup();
  const keys = [
    ['booking', 'record'],
    ['payment-status'],
    ['bookings-history'],
  ];
  seed(client, keys);
  jest.mocked(fetch).mockResolvedValue({
    ok: true,
    json: async () => ({
      success: true,
      data: { url: 'https://checkout.invalid' },
    }),
  } as Response);
  const { result } = renderHook(() => useCreateCheckoutSession(), { wrapper });
  await act(async () => {
    await result.current.mutateAsync('record');
  });
  expectStale(client, keys);
  expect(client.getQueryData(['booking', 'record'])).toEqual({ isPaid: false });
});
test('failed reservation mutations keep cached data fresh', async () => {
  const { client, wrapper } = setup();
  const keys = [
    ['booking', 'record'],
    ['cabin-availability', 'cabin'],
    ['dining-reservation', 'record'],
    ['dining-availability', 'listing'],
    ['experience-booking', 'record'],
    ['payment-status'],
  ];
  seed(client, keys);
  jest.mocked(fetch).mockResolvedValue({
    ok: false,
    json: async () => ({ error: 'Denied' }),
  } as Response);
  const { result } = renderHook(
    () => ({
      cabin: useCancelBooking(),
      dining: useCancelDiningReservation(),
      experience: useCancelExperienceBooking(),
      createExperience: useCreateExperienceBooking(),
      checkout: useCreateCheckoutSession(),
    }),
    { wrapper }
  );
  await act(async () => {
    await expect(
      result.current.cabin.mutateAsync({ bookingId: 'record' })
    ).rejects.toThrow('Denied');
    await expect(result.current.dining.mutateAsync('record')).rejects.toThrow(
      'Denied'
    );
    await expect(
      result.current.experience.mutateAsync('record')
    ).rejects.toThrow('Denied');
    await expect(
      result.current.createExperience.mutateAsync({
        experienceId: 'listing',
        date: '2030-06-01',
        numParticipants: 2,
      })
    ).rejects.toThrow('Denied');
    await expect(result.current.checkout.mutateAsync('record')).rejects.toThrow(
      'Denied'
    );
  });
  for (const key of keys)
    expect(client.getQueryState(key)?.isInvalidated).toBe(false);
});

test('a failed SWR availability refresh does not reject a committed booking', async () => {
  const { wrapper } = setup();
  const readAvailability = jest
    .fn()
    .mockResolvedValueOnce({ available: 1 })
    .mockRejectedValue(new Error('refresh offline'));
  jest.mocked(fetch).mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, data: {} }),
  } as Response);
  const { result } = renderHook(
    () => ({
      availability: useSWR('/api/cabins/cabin/availability', readAvailability, {
        shouldRetryOnError: false,
      }),
      create: useCreateBooking(),
    }),
    { wrapper }
  );
  await waitFor(() =>
    expect(result.current.availability.data?.available).toBe(1)
  );
  await act(async () => {
    await expect(
      result.current.create.mutateAsync({
        cabinId: 'cabin',
        checkInDate: '2030-06-01',
        checkOutDate: '2030-06-03',
        numGuests: 2,
      })
    ).resolves.toMatchObject({ success: true });
  });
  await waitFor(() =>
    expect(result.current.availability.error?.message).toBe('refresh offline')
  );
  expect(result.current.availability.data?.available).toBe(1);
});
