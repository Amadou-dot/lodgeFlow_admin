/** @jest-environment ./__tests__/setup/fetch-jsdom.cjs */
import { createElement, type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SWRConfig } from 'swr';
import { useCustomers } from '@/hooks/useCustomers';
import { useInfiniteCustomers } from '@/hooks/useInfiniteCustomers';
import type { CustomerJson } from '@/types/customer-json';
import { customerJsonFixture } from '../setup/customer-json';

jest.unmock('swr');

const guest = customerJsonFixture;
const legacyProfile: CustomerJson = {
  ...guest,
  id: 'user_rich',
  nationalId: 'legacy identifier with spaces',
  address: { city: 'X'.repeat(300) },
  preferences: { specialRequests: 'X'.repeat(800) },
  lastBookingDate: '2029-12-01T00:00:00.000Z',
  totalSpent: 123.456,
  recentBookings: [
    {
      _id: 'booking_old',
      checkInDate: '2029-12-01T00:00:00.000Z',
      checkOutDate: '2029-12-02T00:00:00.000Z',
      numNights: 1,
      status: 'checked-out',
      totalPrice: 123.456,
    },
  ],
};
const richGuest = {
  ...legacyProfile,
  address: { ...legacyProfile.address, futureAddressField: 'preserved' },
  preferences: { ...legacyProfile.preferences, futurePreference: true },
  recentBookings: legacyProfile.recentBookings?.map(booking => ({
    ...booking,
    futureBookingField: 'preserved',
  })),
  futureCustomerField: 'preserved',
};

function list(data: unknown[] = [guest], currentPage = 1) {
  return {
    success: true,
    data,
    pagination: {
      currentPage,
      totalPages: data.length ? 2 : 0,
      totalCustomers: data.length,
      limit: 20,
      hasNextPage: data.length > 0 && currentPage === 1,
      hasPrevPage: currentPage > 1,
      futurePaginationField: true,
    },
    futureEnvelopeField: 'preserved',
  };
}

const originalFetch = global.fetch;
const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
let client: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return createElement(
    QueryClientProvider,
    { client },
    createElement(
      SWRConfig,
      {
        value: {
          provider: () => new Map(),
          dedupingInterval: 0,
          revalidateOnFocus: false,
          shouldRetryOnError: false,
        },
      },
      children
    )
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
});
afterEach(() => {
  client.clear();
  global.fetch = originalFetch;
});

test.each([
  { label: 'empty', customers: [] },
  { label: 'sparse', customers: [guest] },
  { label: 'full and additive fields', customers: [richGuest] },
])(
  'both list consumers preserve valid legacy profiles: $label',
  async ({ customers }) => {
    const body = list(customers);
    fetchMock.mockImplementation(async () => Response.json(body));
    const { result } = renderHook(
      () => ({ paged: useCustomers(), infinite: useInfiniteCustomers() }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.paged.pagination).toBeDefined());
    await waitFor(() => expect(result.current.infinite.isLoading).toBe(false));
    expect(result.current.paged.data).toEqual(customers);
    expect(result.current.infinite.customers).toEqual(customers);
    expect(result.current.paged.pagination).toEqual({
      currentPage: 1,
      totalPages: body.pagination.totalPages,
      totalItems: customers.length,
      itemsPerPage: 20,
      hasNextPage: body.pagination.hasNextPage,
      hasPreviousPage: false,
    });
    expect(client.getQueryData(['customers', ''])).toEqual({
      pageParams: [1],
      pages: [body],
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/customers?');
    expect(fetchMock).toHaveBeenCalledWith('/api/customers?page=1&limit=20');
  }
);

test.each([403, 500])(
  'HTTP %i keeps the existing safe list error',
  async status => {
    fetchMock.mockImplementation(async () =>
      Response.json(
        { success: false, error: 'private provider details' },
        { status }
      )
    );
    const { result } = renderHook(
      () => ({ paged: useCustomers(), infinite: useInfiniteCustomers() }),
      { wrapper }
    );
    await waitFor(() =>
      expect(result.current.paged.error?.message).toBe(
        'Failed to fetch customers'
      )
    );
    await waitFor(() => expect(result.current.infinite.hasMore).toBe(false));
    expect(result.current.paged.data).toEqual([]);
    expect(result.current.infinite.customers).toEqual([]);
  }
);

test('SWR revalidation keeps prior customers after a transient failure', async () => {
  fetchMock.mockImplementation(async () => Response.json(list()));
  const { result } = renderHook(() => useCustomers(), { wrapper });
  await waitFor(() => expect(result.current.data).toEqual([guest]));
  fetchMock.mockImplementation(async () => new Response(null, { status: 500 }));
  await act(async () => {
    await result.current.mutate();
  });
  expect(result.current.data).toEqual([guest]);
  expect(result.current.error?.message).toBe('Failed to fetch customers');
});

test.each([
  { label: 'null body', body: null },
  { label: 'primitive body', body: 'private payload' },
  {
    label: 'failure envelope',
    body: { success: false, error: 'private detail' },
  },
  { label: 'nonboolean success', body: { ...list(), success: 'true' } },
  { label: 'invalid ID', body: list([{ ...guest, id: 12 }]) },
  { label: 'invalid name', body: list([{ ...guest, name: null }]) },
  {
    label: 'invalid timestamp',
    body: list([{ ...guest, created_at: 'yesterday' }]),
  },
  {
    label: 'invalid nullable timestamp',
    body: list([{ ...guest, last_sign_in_at: false }]),
  },
  { label: 'invalid status flag', body: list([{ ...guest, locked: 'false' }]) },
  {
    label: 'invalid metadata',
    body: list([{ ...guest, address: { city: 123 } }]),
  },
  {
    label: 'invalid money representation',
    body: list([{ ...guest, totalSpent: '123' }]),
  },
  {
    label: 'unknown loyalty tier',
    body: list([{ ...guest, loyaltyTier: 'Platinum' }]),
  },
  {
    label: 'one bad row',
    body: list([guest, { ...guest, id: 'user_bad', name: 123 }]),
  },
  {
    label: 'invalid pagination flag',
    body: {
      ...list(),
      pagination: { ...list().pagination, hasNextPage: 'yes' },
    },
  },
  {
    label: 'missing pagination count',
    body: {
      ...list(),
      pagination: { ...list().pagination, totalCustomers: undefined },
    },
  },
])('rejects $label before either cache accepts it', async ({ body }) => {
  fetchMock.mockImplementation(async () => Response.json(body));
  const { result } = renderHook(
    () => ({ paged: useCustomers(), infinite: useInfiniteCustomers() }),
    { wrapper }
  );
  await waitFor(() =>
    expect(result.current.paged.error?.message).toBe(
      'Failed to fetch customers'
    )
  );
  await waitFor(() =>
    expect(client.getQueryState(['customers', ''])?.error).toEqual(
      new Error('Failed to fetch customers')
    )
  );
  expect(result.current.paged.data).toEqual([]);
  expect(result.current.paged.pagination).toBeUndefined();
  expect(result.current.infinite.customers).toEqual([]);
  expect(client.getQueryData(['customers', ''])).toBeUndefined();
});

test('malformed JSON never exposes parser details in either query error', async () => {
  fetchMock.mockImplementation(async () => new Response('{ private response'));
  const { result } = renderHook(
    () => ({ paged: useCustomers(), infinite: useInfiniteCustomers() }),
    { wrapper }
  );
  await waitFor(() =>
    expect(result.current.paged.error?.message).toBe(
      'Failed to fetch customers'
    )
  );
  await waitFor(() =>
    expect(client.getQueryState(['customers', ''])?.error).toEqual(
      new Error('Failed to fetch customers')
    )
  );
});

test('invalid SWR revalidation retains valid data and can retry', async () => {
  fetchMock.mockImplementation(async () => Response.json(list()));
  const { result } = renderHook(() => useCustomers(), { wrapper });
  await waitFor(() => expect(result.current.data).toEqual([guest]));
  fetchMock.mockImplementation(async () =>
    Response.json(list([{ ...guest, name: 123 }]))
  );
  await act(async () => {
    await result.current.mutate();
  });
  expect(result.current.data).toEqual([guest]);
  expect(result.current.error?.message).toBe('Failed to fetch customers');
  fetchMock.mockImplementation(async () => Response.json(list([richGuest])));
  await act(async () => {
    await result.current.mutate();
  });
  expect(result.current.data).toEqual([richGuest]);
  expect(result.current.error).toBeUndefined();
});

test('a malformed next page retains valid pages and retries the same page', async () => {
  let attempts = 0;
  fetchMock.mockImplementation(async url => {
    if (String(url).includes('page=2')) {
      attempts += 1;
      return Response.json(
        list(attempts === 1 ? [{ ...guest, id: 123 }] : [guest, richGuest], 2)
      );
    }
    return Response.json(list());
  });
  const { result } = renderHook(() => useInfiniteCustomers(), { wrapper });
  await waitFor(() => expect(result.current.customers).toEqual([guest]));
  act(() => result.current.onLoadMore());
  await waitFor(() => expect(attempts).toBe(1));
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.customers).toEqual([guest]);
  expect(result.current.hasMore).toBe(true);
  expect(client.getQueryState(['customers', ''])?.error).toEqual(
    new Error('Failed to fetch customers')
  );
  act(() => result.current.onLoadMore());
  await waitFor(() =>
    expect(result.current.customers).toEqual([guest, richGuest])
  );
  expect(attempts).toBe(2);
  expect(result.current.hasMore).toBe(false);
});
