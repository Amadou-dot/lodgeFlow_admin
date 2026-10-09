import { createElement, type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { addToast } from '@heroui/toast';
import type { Cabin, CabinFilters, CreateCabinData } from '@/types';
import {
  useCabins,
  useCabin,
  useCreateCabin,
  useUpdateCabin,
  useDeleteCabin,
  useBulkDeleteCabins,
  useBulkUpdateDiscount,
} from '@/hooks/useCabins';

const fetchMock = jest.fn();
const originalFetch = global.fetch;
let client: QueryClient;
const createInput = {
  name: 'Pine Cabin',
  price: 200,
  capacity: 4,
  discount: 0,
  image: 'https://example.invalid/pine.jpg',
  description: 'A forest retreat',
  amenities: ['WiFi'],
} satisfies CreateCabinData;
const cabin: Cabin = {
  ...createInput,
  _id: '507f1f77bcf86cd799439011',
  id: '507f1f77bcf86cd799439011',
  images: [],
  status: 'active' as const,
  extraGuestFee: 0,
  discountedPrice: 200,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
function response({ body, ok = true }: { body: unknown; ok?: boolean }) {
  return { ok, json: async () => body } satisfies Pick<Response, 'ok' | 'json'>;
}
function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client }, children);
}
beforeEach(() => {
  jest.clearAllMocks();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(
    response({ body: { success: true, data: [cabin] } })
  );
  global.fetch = fetchMock;
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});
afterEach(() => {
  client.clear();
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('cabin query contracts', () => {
  test.each<[CabinFilters, string]>([
    [{}, '/api/cabins?'],
    [
      {
        search: 'pine & lake',
        status: 'active',
        sortBy: 'price',
        sortOrder: 'desc',
      },
      '/api/cabins?search=pine+%26+lake&status=active&sortBy=price&sortOrder=desc',
    ],
    [{ capacity: 'small' }, '/api/cabins?capacity=small'],
    [{ discount: 'with' }, '/api/cabins?discount=with'],
    [{ filter: 'with-discount' }, '/api/cabins?filter=with-discount'],
  ])('keeps query keys, filters and JSON for %j', async (filters, url) => {
    const { result } = renderHook(() => useCabins(filters), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(url);
    expect(client.getQueryData(['cabins', filters])).toEqual([cabin]);
    expect(result.current.data).toEqual([cabin]);
    expect(result.current.data?.[0]._id).toBe(cabin._id);
    expect(result.current.data?.[0].createdAt).toBe(cabin.createdAt);
  });
  test('uses empty filters by default', async () => {
    const { result } = renderHook(() => useCabins(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.getQueryData(['cabins', {}])).toEqual([cabin]);
  });
  test('retains the legacy bare list response', async () => {
    fetchMock.mockResolvedValue(response({ body: [cabin] }));
    const { result } = renderHook(() => useCabins(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([cabin]);
  });
  test('reports read failure', async () => {
    fetchMock.mockResolvedValue(response({ ok: false, body: {} }));
    const { result } = renderHook(() => useCabins(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Failed to fetch cabins');
  });
  test.each([true, false])(
    'keeps detail query and response with envelope=%p',
    async envelope => {
      fetchMock.mockResolvedValue(
        response({ body: envelope ? { success: true, data: cabin } : cabin })
      );
      const { result } = renderHook(() => useCabin(cabin._id), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(fetchMock).toHaveBeenCalledWith(`/api/cabins/${cabin._id}`);
      expect(client.getQueryData(['cabin', cabin._id])).toEqual(cabin);
    }
  );
  test('does not fetch without an ID', () => {
    renderHook(() => useCabin(''), { wrapper });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  test('reports detail failure', async () => {
    fetchMock.mockResolvedValue(response({ ok: false, body: {} }));
    const { result } = renderHook(() => useCabin(cabin._id), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Failed to fetch cabin');
  });
});

describe('cabin mutation contracts', () => {
  test('creates with the exact request, returns JSON and invalidates catalog/statistics', async () => {
    fetchMock.mockResolvedValue(
      response({ body: { success: true, data: cabin } })
    );
    const invalidated = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useCreateCabin(), { wrapper });
    await act(async () => {
      expect(await result.current.mutateAsync(createInput)).toEqual(cabin);
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/cabins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createInput),
    });
    expect(invalidated.mock.calls).toEqual([
      [{ queryKey: ['cabins'] }],
      [{ queryKey: ['cabin-stats'] }],
    ]);
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Cabin created successfully',
        color: 'success',
      })
    );
  });
  test.each([
    {
      body: { error: 'Duplicate cabin', message: 'Please rename' },
      error: 'Duplicate cabin',
      toast: 'Please rename',
    },
    {
      body: {},
      error: 'Failed to create cabin',
      toast: 'Failed to create cabin',
    },
  ])(
    'keeps create failure and does not invalidate: %j',
    async ({ body, error, toast }) => {
      fetchMock.mockResolvedValue(response({ ok: false, body }));
      const invalidated = jest.spyOn(client, 'invalidateQueries');
      const { result } = renderHook(() => useCreateCabin(), { wrapper });
      await act(async () => {
        await expect(result.current.mutateAsync(createInput)).rejects.toThrow(
          error
        );
      });
      expect(invalidated).not.toHaveBeenCalled();
      expect(addToast).toHaveBeenCalledWith(
        expect.objectContaining({ description: toast, color: 'danger' })
      );
    }
  );
  test('updates only supplied fields and keeps invalidation/toast behavior', async () => {
    const input = { _id: cabin._id, name: 'Renamed' };
    const updated = { ...cabin, name: input.name };
    fetchMock.mockResolvedValue(
      response({ body: { success: true, data: updated } })
    );
    const invalidated = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateCabin(), { wrapper });
    await act(async () => {
      expect(await result.current.mutateAsync(input)).toEqual(updated);
    });
    expect(fetchMock).toHaveBeenCalledWith(`/api/cabins/${cabin._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    expect(invalidated.mock.calls).toEqual([
      [{ queryKey: ['cabins'] }],
      [{ queryKey: ['cabin-stats'] }],
      [{ queryKey: ['cabin', cabin._id] }],
    ]);
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Cabin updated successfully',
        color: 'success',
      })
    );
  });
  test('keeps update failure without invalidation', async () => {
    fetchMock.mockResolvedValue(
      response({ ok: false, body: { error: 'Invalid price' } })
    );
    const invalidated = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateCabin(), { wrapper });
    await act(async () => {
      await expect(
        result.current.mutateAsync({ _id: cabin._id, price: 0 })
      ).rejects.toThrow('Invalid price');
    });
    expect(invalidated).not.toHaveBeenCalled();
  });
  test('deletes by string ID and invalidates both caches', async () => {
    const body = {
      success: true,
      data: null,
      message: 'Cabin deleted successfully',
    };
    fetchMock.mockResolvedValue(response({ body }));
    const invalidated = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteCabin(), { wrapper });
    await act(async () => {
      expect(await result.current.mutateAsync(cabin._id)).toEqual(body);
    });
    expect(fetchMock).toHaveBeenCalledWith(`/api/cabins/${cabin._id}`, {
      method: 'DELETE',
    });
    expect(invalidated.mock.calls).toEqual([
      [{ queryKey: ['cabins'] }],
      [{ queryKey: ['cabin-stats'] }],
      [{ queryKey: ['cabin', cabin._id] }],
    ]);
  });
  test('keeps deletion failure without invalidation', async () => {
    fetchMock.mockResolvedValue(
      response({ ok: false, body: { error: 'Cabin has active bookings' } })
    );
    const invalidated = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteCabin(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync(cabin._id)).rejects.toThrow(
        'Cabin has active bookings'
      );
    });
    expect(invalidated).not.toHaveBeenCalled();
  });
  test.each([0, 1, 3])(
    'keeps bulk delete request, count %i, toast and invalidation',
    async deletedCount => {
      fetchMock.mockResolvedValue(
        response({ body: { success: true, data: { deletedCount } } })
      );
      const invalidated = jest.spyOn(client, 'invalidateQueries');
      const { result } = renderHook(() => useBulkDeleteCabins(), { wrapper });
      await act(async () => {
        expect(await result.current.mutateAsync([cabin._id])).toEqual({
          deletedCount,
        });
      });
      expect(fetchMock).toHaveBeenCalledWith('/api/cabins/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', ids: [cabin._id] }),
      });
      expect(invalidated.mock.calls).toEqual([
        [{ queryKey: ['cabins'] }],
        [{ queryKey: ['cabin-stats'] }],
        [{ queryKey: ['cabin', cabin._id] }],
      ]);
      expect(addToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: `${deletedCount} cabin${deletedCount === 1 ? '' : 's'} deleted`,
          color: 'success',
        })
      );
    }
  );
  test.each([1, 2])(
    'keeps bulk discount request, count %i, toast and invalidation',
    async modifiedCount => {
      fetchMock.mockResolvedValue(
        response({ body: { success: true, data: { modifiedCount } } })
      );
      const invalidated = jest.spyOn(client, 'invalidateQueries');
      const { result } = renderHook(() => useBulkUpdateDiscount(), { wrapper });
      const input = { ids: [cabin._id], discount: 15 };
      await act(async () => {
        expect(await result.current.mutateAsync(input)).toEqual({
          modifiedCount,
        });
      });
      expect(fetchMock).toHaveBeenCalledWith('/api/cabins/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-discount', ...input }),
      });
      expect(invalidated.mock.calls).toEqual([
        [{ queryKey: ['cabins'] }],
        [{ queryKey: ['cabin-stats'] }],
        [{ queryKey: ['cabin', cabin._id] }],
      ]);
      expect(addToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: `Discount updated for ${modifiedCount} cabin${modifiedCount === 1 ? '' : 's'}`,
          color: 'success',
        })
      );
    }
  );
});

test('successful update refreshes the mounted detail reader; failed update leaves it untouched', async () => {
  let savedName = cabin.name;
  let fail = false;
  fetchMock.mockImplementation((_url: string, input?: RequestInit) => {
    if (input?.method === 'PUT') {
      if (fail)
        return Promise.resolve(
          response({ ok: false, body: { error: 'Update denied' } })
        );
      savedName = 'Updated detail';
    }
    return Promise.resolve(
      response({ body: { success: true, data: { ...cabin, name: savedName } } })
    );
  });
  const { result } = renderHook(
    () => ({ detail: useCabin(cabin._id), update: useUpdateCabin() }),
    { wrapper }
  );
  await waitFor(() =>
    expect(result.current.detail.data?.name).toBe(cabin.name)
  );
  await act(async () => {
    await result.current.update.mutateAsync({
      _id: cabin._id,
      name: 'Updated detail',
    });
  });
  await waitFor(() =>
    expect(result.current.detail.data?.name).toBe('Updated detail')
  );
  const fetchCount = fetchMock.mock.calls.length;
  fail = true;
  await act(async () => {
    await expect(
      result.current.update.mutateAsync({ _id: cabin._id, name: 'Denied' })
    ).rejects.toThrow('Update denied');
  });
  expect(result.current.detail.data?.name).toBe('Updated detail');
  expect(fetchMock).toHaveBeenCalledTimes(fetchCount + 1);
});
test.each(['delete', 'discount'] as const)(
  'bulk %s failure does not refresh and successful retry invalidates each affected detail',
  async action => {
    fetchMock
      .mockResolvedValueOnce(
        response({ ok: false, body: { error: 'Try again' } })
      )
      .mockResolvedValueOnce(
        response({
          body: { success: true, data: { deletedCount: 2, modifiedCount: 2 } },
        })
      );
    const invalidated = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(
      () => ({
        remove: useBulkDeleteCabins(),
        discount: useBulkUpdateDiscount(),
      }),
      { wrapper }
    );
    const run = () =>
      action === 'delete'
        ? result.current.remove.mutateAsync(['one', 'two'])
        : result.current.discount.mutateAsync({
            ids: ['one', 'two'],
            discount: 15,
          });
    await act(async () => {
      await expect(run()).rejects.toThrow('Try again');
    });
    expect(invalidated).not.toHaveBeenCalled();
    await act(async () => {
      await run();
    });
    expect(invalidated.mock.calls).toEqual([
      [{ queryKey: ['cabins'] }],
      [{ queryKey: ['cabin-stats'] }],
      [{ queryKey: ['cabin', 'one'] }],
      [{ queryKey: ['cabin', 'two'] }],
    ]);
  }
);
