/** @jest-environment ./__tests__/setup/fetch-jsdom.cjs */
import { createElement, type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import useSWR, { SWRConfig } from 'swr';
import {
  useCustomer,
  useCustomers,
  useLockCustomer,
  useUnlockCustomer,
} from '@/hooks/useCustomers';
import { useInfiniteCustomers } from '@/hooks/useInfiniteCustomers';
import { customerJsonFixture } from '../setup/customer-json';

jest.unmock('swr');
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
          shouldRetryOnError: false,
          revalidateOnFocus: false,
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
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});
afterEach(() => {
  client.clear();
  global.fetch = originalFetch;
});

const cases = [
  {
    action: 'lock',
    useChange: useLockCustomer,
    method: 'POST',
    locked: true,
    timeKey: 'lockedAt',
  },
  {
    action: 'unlock',
    useChange: useUnlockCustomer,
    method: 'DELETE',
    locked: false,
    timeKey: 'unlockedAt',
  },
] as const;

describe.each(cases)(
  '$action customer acknowledgement',
  ({ action, useChange, method, locked, timeKey }) => {
    const valid = () => ({
      success: true,
      data: {
        locked,
        [timeKey]: '2030-01-02T03:04:05.000Z',
        future: 'retained',
      },
      message: 'Done',
      future: true,
    });

    test('refreshes customer list/detail caches while unrelated reads stay unchanged', async () => {
      let current = !locked;
      fetchMock.mockImplementation(async (input, init) => {
        if (init?.method) {
          current = locked;
          return Response.json(valid());
        }
        if (input === '/api/bookings?')
          return Response.json({ revision: current });
        const guest = { ...customerJsonFixture, locked: current };
        if (input === '/api/customers/user_guest')
          return Response.json({
            success: true,
            data: {
              ...guest,
              completedBookings: 0,
              totalRevenue: 0,
              averageStayLength: 0,
              recentBookings: [],
            },
          });
        return Response.json({
          success: true,
          data: [guest],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalCustomers: 1,
            limit: 20,
            hasNextPage: false,
            hasPrevPage: false,
          },
        });
      });
      const { result } = renderHook(
        () => ({
          change: useChange(),
          detail: useCustomer('user_guest'),
          list: useCustomers(),
          infinite: useInfiniteCustomers(),
          unrelated: useSWR('/api/bookings?', async (url: string) =>
            (await fetch(url)).json()
          ),
        }),
        { wrapper }
      );
      await waitFor(() =>
        expect(result.current.detail.data?.locked).toBe(!locked)
      );
      await waitFor(() =>
        expect(result.current.list.data[0]?.locked).toBe(!locked)
      );
      await waitFor(() =>
        expect(result.current.infinite.customers[0]?.locked).toBe(!locked)
      );
      await waitFor(() =>
        expect(result.current.unrelated.data).toEqual({ revision: !locked })
      );
      const invalidations = jest.spyOn(client, 'invalidateQueries');
      await act(async () => {
        expect(await result.current.change.mutateAsync('user_guest')).toEqual({
          success: true,
        });
      });
      expect(fetchMock).toHaveBeenCalledWith('/api/customers/user_guest/lock', {
        method,
      });
      await waitFor(() =>
        expect(result.current.detail.data?.locked).toBe(locked)
      );
      await waitFor(() =>
        expect(result.current.list.data[0]?.locked).toBe(locked)
      );
      await waitFor(() =>
        expect(result.current.infinite.customers[0]?.locked).toBe(locked)
      );
      expect(result.current.unrelated.data).toEqual({ revision: !locked });
      expect(
        fetchMock.mock.calls.filter(([url]) => url === '/api/bookings?')
      ).toHaveLength(1);
      expect(invalidations).toHaveBeenCalledTimes(1);
      expect(invalidations).toHaveBeenCalledWith({ queryKey: ['customers'] });
    });

    test.each([
      { status: 403, body: { success: false, error: 'Denied' } },
      { status: 400, body: { error: 'Denied' } },
      { status: 200, body: { success: false, error: 'Denied' } },
    ])(
      'retains a server error at HTTP $status without success effects',
      async ({ status, body }) => {
        fetchMock.mockResolvedValue(Response.json(body, { status }));
        const invalidations = jest.spyOn(client, 'invalidateQueries');
        const { result } = renderHook(() => useChange(), { wrapper });
        await act(async () => {
          await expect(
            result.current.mutateAsync('user_guest')
          ).rejects.toThrow('Denied');
        });
        expect(invalidations).not.toHaveBeenCalled();
        expect(result.current.isSuccess).toBe(false);
      }
    );

    test.each([
      { label: 'null', body: null },
      { label: 'primitive', body: 42 },
      { label: 'missing data', body: { success: true } },
      { label: 'null data', body: { success: true, data: null } },
      { label: 'truthy success', body: { ...valid(), success: 'true' } },
      {
        label: 'opposite flag',
        body: {
          success: true,
          data: { locked: !locked, [timeKey]: '2030-01-02T03:04:05.000Z' },
        },
      },
      { label: 'missing timestamp', body: { success: true, data: { locked } } },
      {
        label: 'invalid timestamp',
        body: { success: true, data: { locked, [timeKey]: 'yesterday' } },
      },
      {
        label: 'wrong timestamp key',
        body: {
          success: true,
          data: {
            locked,
            [locked ? 'unlockedAt' : 'lockedAt']: '2030-01-02T03:04:05.000Z',
          },
        },
      },
      {
        label: 'object error',
        body: { success: false, error: { private: 'provider detail' } },
      },
    ])('rejects $label without success effects', async ({ body }) => {
      fetchMock.mockResolvedValue(Response.json(body));
      const invalidations = jest.spyOn(client, 'invalidateQueries');
      const { result } = renderHook(() => useChange(), { wrapper });
      await act(async () => {
        await expect(result.current.mutateAsync('user_guest')).rejects.toThrow(
          `Failed to ${action} customer`
        );
      });
      expect(invalidations).not.toHaveBeenCalled();
      expect(result.current.isSuccess).toBe(false);
    });

    test.each([200, 502])(
      'replaces malformed JSON at HTTP %s with the safe fallback',
      async status => {
        fetchMock.mockResolvedValue(
          new Response('<html>private proxy detail</html>', { status })
        );
        const { result } = renderHook(() => useChange(), { wrapper });
        await act(async () => {
          await expect(
            result.current.mutateAsync('user_guest')
          ).rejects.toThrow(`Failed to ${action} customer`);
        });
      }
    );

    test('rejects an HTTP failure carrying a valid-looking success body', async () => {
      fetchMock.mockResolvedValue(Response.json(valid(), { status: 500 }));
      const { result } = renderHook(() => useChange(), { wrapper });
      await act(async () => {
        await expect(result.current.mutateAsync('user_guest')).rejects.toThrow(
          `Failed to ${action} customer`
        );
      });
    });

    test('recovers after a malformed acknowledgement and only then refreshes', async () => {
      fetchMock
        .mockResolvedValueOnce(Response.json({ success: true }))
        .mockResolvedValueOnce(Response.json(valid()));
      const invalidations = jest.spyOn(client, 'invalidateQueries');
      const { result } = renderHook(() => useChange(), { wrapper });
      await act(async () => {
        await expect(result.current.mutateAsync('user_guest')).rejects.toThrow(
          `Failed to ${action} customer`
        );
      });
      expect(invalidations).not.toHaveBeenCalled();
      await act(async () => {
        await expect(result.current.mutateAsync('user_guest')).resolves.toEqual(
          { success: true }
        );
      });
      expect(invalidations).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  }
);
