import { FetchResponse } from '@/__tests__/shared/checkout-failure-fixtures';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import useSWR, { SWRConfig } from 'swr';
import {
  useCancelBooking,
  useCreateBooking,
  useUpdateBooking,
} from '@/hooks/useBooking';
import {
  useCancelDiningReservation,
  useCreateDiningReservation,
} from '@/hooks/useDiningReservation';
import {
  useCancelExperienceBooking,
  useCreateExperienceBooking,
} from '@/hooks/useExperienceBooking';
import { useCreateCheckoutSession } from '@/hooks/usePayment';

let mockActor = 'test-user-id';
let mockSession = 'session-one';
jest.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    userId: mockActor,
    sessionId: mockSession,
  }),
}));
const id = '507f1f77bcf86cd7994390ab';
const other = '507f1f77bcf86cd7994390cd';
const cabinDetail = {
  _id: id,
  id,
  customer: 'test-user-id',
  cabin: null,
  status: 'unconfirmed',
  checkInDate: '2030-06-01T00:00:00.000Z',
  checkOutDate: '2030-06-03T00:00:00.000Z',
  numGuests: 2,
  numNights: 2,
  totalPrice: 50,
  cabinPrice: 50,
  specialRequests: [null, 'Extra towels'],
};
const refund = {
  amount: 0,
  type: 'none',
  status: 'none',
  reason: 'No receipts',
};
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
      ...(action === 'cancel' ? [['booking', id]] : []),
    ];
    seed(client, keys);
    let available = 1;
    const readAvailability = jest.fn(async () => ({ available }));
    jest.mocked(fetch).mockResolvedValue({
      ok: true,
      status: action === 'create' ? 201 : 200,
      json: async () => ({
        success: true,
        data: action === 'create' ? cabinDetail : { booking: null, refund },
      }),
    } as Response);
    const { result } = renderHook(
      () => ({
        availability: useSWR(
          '/api/cabins/cabin/availability',
          readAvailability
        ),
        create: useCreateBooking('cabin'),
        cancel: useCancelBooking(id),
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
      else await result.current.cancel.mutateAsync({ bookingId: id });
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
      status: 200,
      json: async () => ({ success: true, data: null }),
    } as Response);
    const { result } = renderHook(
      () => ({
        dining: useCancelDiningReservation(['record']),
        experience: useCancelExperienceBooking(['record']),
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
    status: 201,
    json: async () => ({ success: true, data: null }),
  } as Response);
  const { result } = renderHook(() => useCreateDiningReservation('listing'), {
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
    status: 401,
    json: async () => ({ success: false, error: 'Denied' }),
  } as Response);
  const { result } = renderHook(
    () => ({
      cabin: useCancelBooking('record'),
      dining: useCancelDiningReservation(['record']),
      experience: useCancelExperienceBooking(['record']),
      createExperience: useCreateExperienceBooking('listing'),
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
    status: 201,
    json: async () => ({ success: true, data: cabinDetail }),
  } as Response);
  const { result } = renderHook(
    () => ({
      availability: useSWR('/api/cabins/cabin/availability', readAvailability, {
        shouldRetryOnError: false,
      }),
      create: useCreateBooking('cabin'),
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

test.each([
  { name: 'missing reservation data', data: { success: true } },
  { name: 'false success', data: { success: false, data: null } },
  { name: 'invalid object', data: { success: true, data: {} } },
  {
    name: 'conflicting error',
    data: { success: true, data: null, error: 'Failure' },
  },
  {
    name: 'non-string message',
    data: { success: true, data: null, message: 42 },
  },
])(
  'rejects $name without refreshing either reservation history',
  async ({ data }) => {
    const { client, wrapper } = setup();
    const invalidated = jest.spyOn(client, 'invalidateQueries');
    jest.mocked(fetch).mockImplementation(async () => FetchResponse.json(data));
    const { result } = renderHook(
      () => ({
        dining: useCancelDiningReservation([id]),
        experience: useCancelExperienceBooking([id]),
      }),
      { wrapper }
    );
    for (const mutation of Object.values(result.current))
      await expect(mutation.mutateAsync(id)).rejects.toThrow();
    expect(invalidated).not.toHaveBeenCalled();
  }
);
test.each(['dining', 'experience'] as const)(
  '%s cancellation binds both IDs and the owner while preserving re-read status and raw receipts',
  async kind => {
    const { client, wrapper } = setup();
    const invalidated = jest.spyOn(client, 'invalidateQueries');
    const data = {
      _id: id,
      id,
      customer: 'test-user-id',
      date: '2030-06-01T00:00:00.000Z',
      totalPrice: 50,
      isPaid: false,
      status: 'pending',
      receipts: [
        {
          id: 'legacy',
          type: 'payment',
          amountCents: 1.5,
          method: 'cash',
          reference: '',
          actor: 'staff',
          recordedAt: '2030-06-01T00:00:00.000Z',
          memo: 'keep',
        },
      ],
      ...(kind === 'dining'
        ? { dining: null, numGuests: 2, time: '17:00' }
        : { experience: null, numParticipants: 2 }),
    };
    const { result } = renderHook(
      () => ({
        dining: useCancelDiningReservation([id]),
        experience: useCancelExperienceBooking([id]),
      }),
      { wrapper }
    );
    for (const invalid of [
      { ...data, _id: other, id: other },
      { ...data, id: other },
      { ...data, customer: 'other' },
    ]) {
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(
          FetchResponse.json({ success: true, data: invalid })
        );
      await expect(result.current[kind].mutateAsync(id)).rejects.toThrow();
    }
    expect(invalidated).not.toHaveBeenCalled();
    const response = {
      success: true,
      message: 'Reservation cancelled successfully',
      data,
      addition: 42,
    };
    jest.mocked(fetch).mockResolvedValueOnce(FetchResponse.json(response));
    expect(await result.current[kind].mutateAsync(id.toUpperCase())).toEqual(
      response
    );
    expect(invalidated).toHaveBeenCalled();
  }
);
test.each([
  { booking: { ...cabinDetail, _id: other, id: other }, refund },
  { booking: { ...cabinDetail, id: other }, refund },
  { booking: { ...cabinDetail, customer: 'other' }, refund },
  { booking: null },
  { booking: null, refund: { ...refund, type: 'unknown' } },
  { booking: null, refund: { ...refund, amount: 1.234 } },
  { booking: null, refund: { ...refund, error: true } },
  { booking: null, refund: { ...refund, status: 'pending' } },
  { booking: { ...cabinDetail, refundStatus: 'failed' }, refund },
])(
  'rejects a mismatched cabin cancellation or malformed refund %#',
  async data => {
    const { client, wrapper } = setup();
    const invalidated = jest.spyOn(client, 'invalidateQueries');
    jest
      .mocked(fetch)
      .mockResolvedValue(FetchResponse.json({ success: true, data }));
    const { result } = renderHook(() => useCancelBooking(id), { wrapper });
    await expect(
      result.current.mutateAsync({ bookingId: id })
    ).rejects.toThrow();
    expect(invalidated).not.toHaveBeenCalled();
  }
);

test('cabin edits bind the request ID, changes and owner before any invalidation', async () => {
  const { client, wrapper } = setup();
  const invalidated = jest.spyOn(client, 'invalidateQueries');
  const updates = {
    numGuests: 3,
    specialRequests: [' Towels '],
    extras: { hasBreakfast: true },
  };
  const data = {
    ...cabinDetail,
    numGuests: 3,
    specialRequests: ['Towels'],
    extras: { hasBreakfast: true },
  };
  const variables = { bookingId: id.toUpperCase(), updates };
  const { result } = renderHook(() => useUpdateBooking(id), { wrapper });
  for (const invalid of [
    { ...data, id: other, _id: other },
    { ...data, id: other },
    { ...data, customer: 'other' },
    { ...data, numGuests: 2 },
    { ...data, specialRequests: ['Other'] },
    { ...data, extras: null },
    { ...data, status: 'cancelled' },
  ]) {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(
        FetchResponse.json({ success: true, data: invalid })
      );
    await expect(result.current.mutateAsync(variables)).rejects.toThrow();
  }
  expect(invalidated).not.toHaveBeenCalled();
  jest
    .mocked(fetch)
    .mockResolvedValueOnce(FetchResponse.json({ success: true, data }));
  expect(await result.current.mutateAsync(variables)).toEqual({
    success: true,
    data,
  });
  expect(invalidated).toHaveBeenCalledTimes(2);
});

test.each([
  'same scope',
  'new session',
  'new owner',
  'new resource',
  'removed and restored target',
  'unmount',
] as const)(
  'offline writes preserve the original dispatch scope on reconnect: %s',
  async change => {
    mockActor = 'test-user-id';
    mockSession = 'session-one';
    const { client, wrapper } = setup();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    jest.mocked(fetch).mockImplementation(async (url, init) => {
      const create = init?.method === 'POST';
      const data = String(url).startsWith('/api/bookings')
        ? init?.method === 'DELETE'
          ? { booking: null, refund }
          : cabinDetail
        : null;
      return FetchResponse.json(
        { success: true, data },
        { status: create ? 201 : 200 }
      );
    });
    const hooks = renderHook(
      ({ target }: { target: string }) => ({
        cabin: useCreateBooking(target),
        dining: useCreateDiningReservation(target),
        experience: useCreateExperienceBooking(target),
        edit: useUpdateBooking(target),
        cancel: useCancelBooking(target),
        cancelDining: useCancelDiningReservation([target]),
        cancelExperience: useCancelExperienceBooking([target]),
      }),
      { wrapper, initialProps: { target: id } }
    );
    const { current } = hooks.result;
    onlineManager.setOnline(false);
    try {
      const requests = Promise.allSettled([
        current.cabin.mutateAsync({
          cabinId: id,
          checkInDate: cabinDetail.checkInDate,
          checkOutDate: cabinDetail.checkOutDate,
          numGuests: 2,
        }),
        current.dining.mutateAsync({
          diningId: id,
          date: '2040-01-01',
          numGuests: 2,
          time: '17:00',
        }),
        current.experience.mutateAsync({
          experienceId: id,
          date: '2040-01-01',
          numParticipants: 2,
        }),
        current.edit.mutateAsync({ bookingId: id, updates: { numGuests: 2 } }),
        current.cancel.mutateAsync({ bookingId: id }),
        current.cancelDining.mutateAsync(id),
        current.cancelExperience.mutateAsync(id),
      ]);
      await waitFor(() =>
        expect(
          client
            .getMutationCache()
            .getAll()
            .filter(m => m.state.isPaused)
        ).toHaveLength(7)
      );
      expect(fetch).not.toHaveBeenCalled();
      if (change === 'new owner') mockActor = 'replacement';
      if (change === 'new session') mockSession = 'replacement-session';
      if (change === 'unmount') hooks.unmount();
      else if (change === 'removed and restored target') {
        hooks.rerender({ target: other });
        hooks.rerender({ target: id });
      } else hooks.rerender({ target: change === 'new resource' ? other : id });
      // A connected app has a mounted QueryClient above Clerk, even after this component unmounts.
      await act(async () => {
        onlineManager.setOnline(true);
        await client.resumePausedMutations();
      });
      const outcomes = await requests;
      if (change === 'same scope') {
        expect(fetch).toHaveBeenCalledTimes(7);
        expect(outcomes.every(result => result.status === 'fulfilled')).toBe(
          true
        );
        expect(invalidate).toHaveBeenCalled();
      } else {
        expect(fetch).not.toHaveBeenCalled();
        expect(outcomes.every(result => result.status === 'rejected')).toBe(
          true
        );
        expect(invalidate).not.toHaveBeenCalled();
      }
    } finally {
      onlineManager.setOnline(true);
      mockActor = 'test-user-id';
      mockSession = 'session-one';
      client.clear();
    }
  }
);
