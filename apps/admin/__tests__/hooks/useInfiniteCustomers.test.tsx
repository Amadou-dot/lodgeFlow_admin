import { createElement, type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useInfiniteCustomers } from '@/hooks/useInfiniteCustomers';
import type { Customer } from '@/types';

const jane: Customer = {
  id: 'user_jane',
  name: 'Jane Guest',
  first_name: 'Jane',
  last_name: 'Guest',
  username: null,
  email: 'jane@example.com',
  image_url: '',
  has_image: false,
  created_at: '2030-01-01T00:00:00.000Z',
  updated_at: '2030-01-01T00:00:00.000Z',
  last_sign_in_at: null,
  last_active_at: '2030-01-01T00:00:00.000Z',
  banned: false,
  locked: false,
  lockout_expires_in_seconds: null,
  totalBookings: 0,
  totalSpent: 0,
  loyaltyTier: 'Bronze',
};
const john: Customer = {
  ...jane,
  id: 'user_john',
  name: 'John Guest',
  first_name: 'John',
  email: 'john@example.com',
};
const originalFetch = global.fetch;
const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
let client: QueryClient;

function page(
  customers: Customer[],
  currentPage: number,
  hasNextPage: boolean
) {
  const checked = {
    ok: true,
    json: async () => ({
      success: true,
      data: customers,
      pagination: {
        currentPage,
        hasNextPage,
        totalPages: hasNextPage ? currentPage + 1 : currentPage,
        totalCustomers: customers.length,
        limit: 20,
        hasPrevPage: currentPage > 1,
      },
    }),
  } satisfies Pick<Response, 'ok' | 'json'>;
  return checked as Response;
}

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client }, children);
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

test('clearing search restores the first unfiltered page and its own pagination', async () => {
  fetchMock.mockImplementation(async url => {
    const request = String(url);
    if (request.includes('search=john')) return page([john], 1, false);
    if (request.includes('page=2')) return page([john], 2, false);
    return page([jane], 1, true);
  });

  const { result } = renderHook(() => useInfiniteCustomers(), { wrapper });
  await waitFor(() => expect(result.current.customers).toEqual([jane]));
  expect(result.current.hasMore).toBe(true);
  act(() => {
    void result.current.searchCustomers('john');
  });
  await waitFor(() => expect(result.current.customers).toEqual([john]));
  expect(result.current.hasMore).toBe(false);

  act(() => {
    void result.current.searchCustomers('');
  });
  expect(result.current.customers).toEqual([jane]);
  expect(result.current.hasMore).toBe(true);
  act(() => result.current.onLoadMore());
  await waitFor(() => expect(result.current.customers).toEqual([jane, john]));
  expect(fetchMock).toHaveBeenCalledWith('/api/customers?page=2&limit=20');
});

test('an older search response cannot replace a newer search', async () => {
  let resolveOld: ((response: Response) => void) | undefined;
  fetchMock.mockImplementation(url => {
    const request = String(url);
    if (request.includes('search=ja')) {
      return new Promise<Response>(resolve => {
        resolveOld = resolve;
      });
    }
    return Promise.resolve(
      page(request.includes('search=jo') ? [john] : [], 1, false)
    );
  });

  const { result } = renderHook(() => useInfiniteCustomers(), { wrapper });
  act(() => {
    void result.current.searchCustomers('ja');
  });
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/customers?page=1&limit=20&search=ja'
    )
  );
  act(() => {
    void result.current.searchCustomers('jo');
  });
  await waitFor(() => expect(result.current.customers).toEqual([john]));
  await act(async () => resolveOld?.(page([jane], 1, false)));
  expect(result.current.customers).toEqual([john]);
});

test('failed search can retry and load more is guarded while a page is pending', async () => {
  let resolveNext: ((response: Response) => void) | undefined;
  let searchAttempts = 0;
  fetchMock.mockImplementation(url => {
    const request = String(url);
    if (request.includes('search=jane')) {
      searchAttempts += 1;
      if (searchAttempts === 1) {
        const checked = {
          ok: false,
          json: async () => ({ error: 'Unavailable' }),
        } satisfies Pick<Response, 'ok' | 'json'>;
        return Promise.resolve(checked as Response);
      }
      if (request.includes('page=2')) {
        return new Promise<Response>(resolve => {
          resolveNext = resolve;
        });
      }
      return Promise.resolve(page([jane], 1, true));
    }
    return Promise.resolve(page([], 1, false));
  });

  const { result } = renderHook(() => useInfiniteCustomers(), { wrapper });
  act(() => {
    void result.current.searchCustomers('jane');
  });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.customers).toEqual([]);

  act(() => {
    void result.current.searchCustomers('jane');
  });
  await waitFor(() => expect(result.current.customers).toEqual([jane]));
  act(() => {
    result.current.onLoadMore();
    result.current.onLoadMore();
  });
  await waitFor(() => expect(resolveNext).toBeDefined());
  expect(
    fetchMock.mock.calls.filter(([url]) => String(url).includes('page=2'))
  ).toHaveLength(1);
  await act(async () => resolveNext?.(page([jane, john], 2, false)));
  await waitFor(() => expect(result.current.customers).toEqual([jane, john]));
  expect(result.current.hasMore).toBe(false);
});

test('a failed next page keeps loaded customers and allows the same page to retry', async () => {
  let nextPageAttempts = 0;
  fetchMock.mockImplementation(url => {
    if (String(url).includes('page=2')) {
      nextPageAttempts += 1;
      if (nextPageAttempts === 1) {
        const checked = {
          ok: false,
          json: async () => ({ error: 'Temporary failure' }),
        } satisfies Pick<Response, 'ok' | 'json'>;
        return Promise.resolve(checked as Response);
      }
      return Promise.resolve(page([jane, john], 2, false));
    }
    return Promise.resolve(page([jane], 1, true));
  });

  const { result } = renderHook(() => useInfiniteCustomers(), { wrapper });
  await waitFor(() => expect(result.current.customers).toEqual([jane]));
  act(() => result.current.onLoadMore());
  await waitFor(() => expect(nextPageAttempts).toBe(1));
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.customers).toEqual([jane]);
  expect(result.current.hasMore).toBe(true);

  act(() => {
    result.current.onLoadMore();
    result.current.onLoadMore();
  });
  await waitFor(() => expect(result.current.customers).toEqual([jane, john]));
  expect(nextPageAttempts).toBe(2);
  expect(result.current.hasMore).toBe(false);
});
