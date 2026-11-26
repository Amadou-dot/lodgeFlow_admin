import { createElement, type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { addToast } from '@heroui/toast';
import type { Experience, ExperienceFilters } from '@/types';
import {
  useExperiences,
  useCreateExperience,
  useUpdateExperience,
  useDeleteExperience,
} from '@/hooks/useExperiences';

const fetchMock = jest.fn();
const originalFetch = global.fetch;
let client: QueryClient;
const experience: Experience = {
  _id: '507f1f77bcf86cd799439011',
  name: 'Forest walk',
  description: 'Explore the forest with a local guide',
  price: 25,
  duration: '2 hours',
  difficulty: 'Easy',
  category: 'Nature',
  image: 'https://example.invalid/walk.jpg',
  gallery: [],
  includes: ['Guide'],
  available: ['Monday'],
  ctaText: 'Book now',
  isPopular: false,
  requirements: [],
  highlights: [],
  whatToBring: [],
  tags: [],
  reviewCount: 0,
};
const createInput = { name: 'New item', price: 35 };
const updateInput = { _id: experience._id, name: 'Renamed' };

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
    response({ body: { success: true, data: [experience] } })
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

describe('useExperiences', () => {
  test.each<[ExperienceFilters, string]>([
    [{}, '?'],
    [
      {
        category: 'outdoor',
        difficulty: 'Challenging',
        search: 'pine & lake',
        sortBy: 'price',
        sortOrder: 'desc',
      },
      '?search=pine+%26+lake&category=outdoor&difficulty=Challenging&sortBy=price&sortOrder=desc',
    ],
  ])('uses the same query keys and URLs for %j', async (filters, query) => {
    const { result } = renderHook(() => useExperiences(filters), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(`/api/experiences${query}`);
    expect(client.getQueryData(['experiences', filters])).toEqual([experience]);
  });

  test('retains bare lists, legacy nulls and additive fields in the cache', async () => {
    const legacy = {
      ...experience,
      price: 12.345,
      image: '/local-image.webp',
      location: null,
      rating: null,
      __v: null,
      updatedAt: '+010000-01-01T00:00:00.000Z',
      additive: { imported: true },
      gallery: null,
      tags: ['', null, 'Local'],
      includes: null,
      available: [],
      isPopular: null,
      maxParticipants: 4.5,
      longDescription: '',
    };
    fetchMock.mockResolvedValue(response({ body: [legacy] }));
    const { result } = renderHook(() => useExperiences(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.getQueryData(['experiences', {}])).toEqual([legacy]);
  });

  test.each([
    { ...experience, difficulty: 'other' },
    { ...experience, ctaText: '' },
    { ...experience, includes: [false] },
    { ...experience, gallery: undefined },
    { ...experience, price: '25' },
    { ...experience, price: Infinity },
    { ...experience, createdAt: '2026-02-30T00:00:00.000Z' },
  ])('rejects a malformed row before it reaches the cache', async invalid => {
    fetchMock.mockResolvedValue(
      response({ body: { success: true, data: [experience, invalid] } })
    );
    const { result } = renderHook(() => useExperiences(), { wrapper });
    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(result.current.error?.message).toBe('Failed to fetch experiences');
    expect(client.getQueryData(['experiences', {}])).toBeUndefined();
  });

  test.each([true, false])(
    'uses the list error for invalid responses (HTTP success=%p)',
    async ok => {
      fetchMock.mockResolvedValue(
        response({ ok, body: { success: false, error: 'Unavailable' } })
      );
      const { result } = renderHook(() => useExperiences(), { wrapper });
      await waitFor(() => expect(result.current.isFetching).toBe(false));
      expect(result.current.error?.message).toBe('Failed to fetch experiences');
    }
  );
});

describe('experience mutations', () => {
  function useMutations() {
    const create = useCreateExperience();
    const update = useUpdateExperience();
    const remove = useDeleteExperience();
    return {
      create: () => create.mutateAsync(createInput),
      update: () => update.mutateAsync(updateInput),
      remove: () => remove.mutateAsync(experience._id),
    };
  }
  const actions = [
    [
      'create',
      'POST',
      '/api/experiences',
      createInput,
      'Experience created successfully',
    ],
    [
      'update',
      'PUT',
      `/api/experiences/${experience._id}`,
      updateInput,
      'Experience updated successfully',
    ],
    ['remove', 'DELETE', `/api/experiences/${experience._id}`, undefined, ''],
  ] as const;

  test.each(actions)(
    'keeps the %s request, return value and success effects',
    async (action, method, url, input, message) => {
      const data =
        action === 'remove'
          ? null
          : { ...experience, name: 'Saved', reservationVersion: 0 };
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
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['experiences'] });
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ['experience-stats'],
      });
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
      fetchMock.mockResolvedValue(response({ body: experience }));
      const { result } = renderHook(useMutations, { wrapper });
      await act(async () => {
        await expect(result.current[action]()).resolves.toEqual(experience);
      });
    }
  );

  test.each([
    ['create', { success: true, data: { _id: experience._id } }, 'create'],
    ['create', { success: true, data: null }, 'create'],
    ['update', { ...experience, price: '25' }, 'update'],
    ['update', { ...experience, success: false, error: 'Denied' }, 'update'],
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
          `Failed to ${verb} experience`
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
            `Failed to ${verb} experience`
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
    };
    fetchMock.mockResolvedValue(
      response({ body: { success: true, data: experience } })
    );
    const { result } = renderHook(useUpdateExperience, { wrapper });
    await act(async () => {
      await result.current.mutateAsync(item);
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/experiences/${experience._id}`,
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          name: 'Renamed',
          _id: experience._id,
        }),
      })
    );
  });
});
