import { createElement, type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { addToast } from '@heroui/toast';
import type { Dining, DiningFilters } from '@/types';
import {
  useDining,
  useCreateDining,
  useUpdateDining,
  useDeleteDining,
} from '@/hooks/useDining';

const fetchMock = jest.fn();
const originalFetch = global.fetch;
let client: QueryClient;
const dining: Dining = {
  _id: '507f1f77bcf86cd799439011',
  name: 'Forest dinner',
  description: 'A seasonal menu in the forest',
  type: 'menu',
  mealType: 'dinner',
  price: 25,
  servingTime: { start: '17:00', end: '22:00' },
  maxPeople: 4,
  minPeople: 1,
  category: 'regular',
  image: 'https://example.invalid/dinner.jpg',
  gallery: [],
  ingredients: [],
  allergens: [],
  dietary: [],
  beverages: [],
  includes: [],
  specialRequirements: [],
  isPopular: false,
  isAvailable: true,
  tags: [],
  reviewCount: 0,
};
const createInput = { name: 'New item', price: 35 };
const updateInput = { _id: dining._id, name: 'Renamed' };

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
    response({ body: { success: true, data: [dining] } })
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

describe('useDining', () => {
  test.each<[DiningFilters, string]>([
    [{}, '?'],
    [
      {
        type: 'menu',
        mealType: 'dinner',
        category: 'regular',
        isAvailable: 'true',
        search: 'pine & lake',
        sortBy: 'price',
        sortOrder: 'asc',
      },
      '?type=menu&mealType=dinner&category=regular&isAvailable=true&search=pine+%26+lake&sortBy=price&sortOrder=asc',
    ],
  ])('uses the same query keys and URLs for %j', async (filters, query) => {
    const { result } = renderHook(() => useDining(filters), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(`/api/dining${query}`);
    expect(client.getQueryData(['dining', filters])).toEqual([dining]);
  });

  test('retains bare lists, legacy nulls and additive fields in the cache', async () => {
    const legacy = {
      ...dining,
      price: 12.345,
      image: '/local-image.webp',
      location: null,
      rating: null,
      __v: null,
      updatedAt: '+010000-01-01T00:00:00.000Z',
      additive: { imported: true },
      gallery: null,
      tags: ['', null, 'Local'],
      dietary: [null, 'vegan'],
      beverages: [
        {
          _id: '507f1f77bcf86cd799439012',
          name: 'Juice',
          category: 'non-alcoholic',
          price: null,
          description: '',
          additive: true,
        },
      ],
      servingTime: { start: 'Evening', end: 'Late', additive: true },
      isAvailable: null,
      minPeople: 1.5,
      maxPeople: 4.5,
    };
    fetchMock.mockResolvedValue(response({ body: [legacy] }));
    const { result } = renderHook(() => useDining(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.getQueryData(['dining', {}])).toEqual([legacy]);
  });

  test.each([
    { ...dining, type: 'other' },
    { ...dining, servingTime: { start: '17:00' } },
    {
      ...dining,
      beverages: [{ _id: dining._id, name: 'Juice', category: 'regular' }],
    },
    { ...dining, beverages: [{ name: 'Juice', category: 'non-alcoholic' }] },
    { ...dining, gallery: undefined },
    { ...dining, price: '25' },
    { ...dining, price: Infinity },
    { ...dining, createdAt: '2026-02-30T00:00:00.000Z' },
  ])('rejects a malformed row before it reaches the cache', async invalid => {
    fetchMock.mockResolvedValue(
      response({ body: { success: true, data: [dining, invalid] } })
    );
    const { result } = renderHook(() => useDining(), { wrapper });
    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(result.current.error?.message).toBe('Failed to fetch dining items');
    expect(client.getQueryData(['dining', {}])).toBeUndefined();
  });

  test.each([true, false])(
    'uses the list error for invalid responses (HTTP success=%p)',
    async ok => {
      fetchMock.mockResolvedValue(
        response({ ok, body: { success: false, error: 'Unavailable' } })
      );
      const { result } = renderHook(() => useDining(), { wrapper });
      await waitFor(() => expect(result.current.isFetching).toBe(false));
      expect(result.current.error?.message).toBe(
        'Failed to fetch dining items'
      );
    }
  );
});

describe('dining item mutations', () => {
  function useMutations() {
    const create = useCreateDining();
    const update = useUpdateDining();
    const remove = useDeleteDining();
    return {
      create: () => create.mutateAsync(createInput),
      update: () => update.mutateAsync(updateInput),
      remove: () => remove.mutateAsync(dining._id),
    };
  }
  const actions = [
    [
      'create',
      'POST',
      '/api/dining',
      createInput,
      'Dining item created successfully',
    ],
    [
      'update',
      'PUT',
      `/api/dining/${dining._id}`,
      updateInput,
      'Dining item updated successfully',
    ],
    ['remove', 'DELETE', `/api/dining/${dining._id}`, undefined, ''],
  ] as const;

  test.each(actions)(
    'keeps the %s request, return value and success effects',
    async (action, method, url, input, message) => {
      const data =
        action === 'remove'
          ? null
          : { ...dining, name: 'Saved', reservationVersion: 0 };
      const envelope = {
        success: true,
        data,
        message: 'Saved',
        additive: true,
      };
      fetchMock.mockResolvedValue(response({ body: envelope }));
      const invalidate = jest.spyOn(client, 'invalidateQueries');
      const { result } = renderHook(useMutations, { wrapper });
      await act(async () => {
        await expect(result.current[action]()).resolves.toEqual(
          action === 'remove' ? envelope : data
        );
      });
      expect(fetchMock).toHaveBeenCalledWith(
        url,
        expect.objectContaining({ method })
      );
      if (input)
        expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual(
          input
        );
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dining'] });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dining-stats'] });
      if (message) {
        expect(addToast).toHaveBeenCalledWith(
          expect.objectContaining({ color: 'success', description: message })
        );
      } else {
        expect(addToast).not.toHaveBeenCalled();
      }
    }
  );

  test.each(['create', 'update'] as const)(
    'retains the bare item fallback for %s',
    async action => {
      fetchMock.mockResolvedValue(response({ body: dining }));
      const { result } = renderHook(useMutations, { wrapper });
      await act(async () => {
        await expect(result.current[action]()).resolves.toEqual(dining);
      });
    }
  );

  test.each([
    ['create', { success: true, data: { _id: dining._id } }, 'create'],
    ['create', { success: true, data: null }, 'create'],
    ['update', { ...dining, price: '25' }, 'update'],
    ['update', { ...dining, _id: '507f1f77bcf86cd799439012' }, 'update'],
    ['update', { ...dining, success: false, error: 'Denied' }, 'update'],
    ['remove', { success: true }, 'delete'],
    ['remove', { success: true, data: {} }, 'delete'],
    ['remove', { success: false, data: null }, 'delete'],
  ] as const)(
    'rejects malformed %s before success effects (%j)',
    async (action, body, verb) => {
      fetchMock.mockResolvedValue(response({ body }));
      const invalidate = jest.spyOn(client, 'invalidateQueries');
      const { result } = renderHook(useMutations, { wrapper });
      await act(async () => {
        await expect(result.current[action]()).rejects.toThrow(
          `Failed to ${verb} dining item`
        );
      });
      expect(invalidate).not.toHaveBeenCalled();
      expect(addToast).not.toHaveBeenCalled();
    }
  );

  test.each(actions)('uses the server error for failed %s', async action => {
    fetchMock.mockResolvedValue(
      response({
        ok: false,
        body: {
          success: false,
          error: 'Validation failed',
          message: 'Check the form',
        },
      })
    );
    const { result } = renderHook(useMutations, { wrapper });
    await act(async () => {
      await expect(result.current[action]()).rejects.toThrow(
        'Validation failed'
      );
    });
    if (action === 'remove') {
      expect(addToast).not.toHaveBeenCalled();
    } else {
      expect(addToast).toHaveBeenCalledWith(
        expect.objectContaining({
          color: 'danger',
          description: 'Check the form',
        })
      );
    }
  });

  describe.each([
    ['null', async (): Promise<null> => null],
    [
      'unreadable JSON',
      async () => {
        throw new SyntaxError('Invalid JSON');
      },
    ],
  ] as const)('%s error body', (_label, json) => {
    test.each([
      ['create', 'create'],
      ['update', 'update'],
      ['remove', 'delete'],
    ] as const)(
      'uses resource-specific fallback for an unstructured %s error',
      async (action, verb) => {
        fetchMock.mockResolvedValue({ ok: false, json } satisfies Pick<
          Response,
          'ok' | 'json'
        >);
        const { result } = renderHook(useMutations, { wrapper });
        await act(async () => {
          await expect(result.current[action]()).rejects.toThrow(
            `Failed to ${verb} dining item`
          );
        });
      }
    );
  });

  test('selects editable fields from an update before posting', async () => {
    const item = {
      ...updateInput,
      createdAt: '2020-01-01T00:00:00.000Z',
      updatedAt: '2020-01-01T00:00:00.000Z',
      __v: 3,
      reservationVersion: 5,
      beverages: [
        {
          _id: '507f1f77bcf86cd799439012',
          name: 'Juice',
          category: 'non-alcoholic' as const,
        },
      ],
    };
    fetchMock.mockResolvedValue(
      response({ body: { success: true, data: dining } })
    );
    const { result } = renderHook(useUpdateDining, { wrapper });
    await act(async () => {
      await result.current.mutateAsync(item);
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/dining/${dining._id}`,
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          name: 'Renamed',
          beverages: [{ name: 'Juice', category: 'non-alcoholic' }],
          _id: dining._id,
        }),
      })
    );
  });
});

test('PUT accepts case-equivalent Mongo IDs', async () => {
  const id = '507f1f77bcf86cd7994390ab';
  const saved = { ...dining, _id: id, id };
  fetchMock.mockResolvedValue(
    response({ body: { success: true, data: saved } })
  );
  const { result } = renderHook(useUpdateDining, { wrapper });
  await act(async () => {
    await expect(
      result.current.mutateAsync({ _id: id.toUpperCase() })
    ).resolves.toEqual(saved);
  });
});
