import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useExperiences } from '@/hooks/useExperiences';
import type { ExperienceQueryParams } from '@/types';
import { createTestQueryClient } from '@/__tests__/shared/test-utils';

const fetchMock = jest.fn();
function response({ body, ok = true }: { body: unknown; ok?: boolean }) {
  return { ok, json: async () => body } satisfies Pick<Response, 'ok' | 'json'>;
}
function setup() {
  const client = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}
beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
  fetchMock.mockResolvedValue(response({ body: { success: true, data: [] } }));
});

describe('experience hook characterization', () => {
  test('uses the existing unfiltered URL and success data', async () => {
    const { wrapper, client } = setup();
    const { result } = renderHook(() => useExperiences(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith('/api/experiences');
    expect(client.getQueryData(['experiences', {}])).toEqual([]);
  });

  test('encodes all existing filter values, including false popularity', async () => {
    const { wrapper } = setup();
    const { result } = renderHook(
      () =>
        useExperiences({
          category: 'Water Sports',
          difficulty: 'Easy',
          minPrice: 10,
          maxPrice: 40,
          isPopular: false,
          tags: ['water', 'family'],
        }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/experiences?category=Water+Sports&difficulty=Easy&minPrice=10&maxPrice=40&isPopular=false&tags=water%2Cfamily'
    );
  });

  test('keeps independent range caches and reuses a fresh matching query', async () => {
    const { wrapper, client } = setup();
    const first: ExperienceQueryParams = { maxPrice: 10 };
    const second: ExperienceQueryParams = { maxPrice: 40 };
    const { result, rerender } = renderHook(
      (params: ExperienceQueryParams) => useExperiences(params),
      { wrapper, initialProps: first }
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    rerender(second);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(client.getQueryData(['experiences', first])).toEqual([]);
    expect(client.getQueryData(['experiences', second])).toEqual([]);
    rerender({ ...first });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      client.getQueryCache().find({ queryKey: ['experiences', first] })?.options
        .gcTime
    ).toBe(600000);
  });

  test.each([
    [false, { success: true, data: [] }, 'Failed to fetch experiences'],
    [
      true,
      { success: false, error: 'Catalog unavailable' },
      'Catalog unavailable',
    ],
    [true, { success: false }, 'Failed to fetch experiences'],
  ])(
    'preserves request/envelope errors (%s, %j)',
    async (ok, body, message) => {
      fetchMock.mockResolvedValue(response({ ok, body }));
      const { wrapper } = setup();
      const { result } = renderHook(() => useExperiences(), { wrapper });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe(message);
    }
  );

  test('preserves the empty fallback for an omitted data field', async () => {
    fetchMock.mockResolvedValue(response({ body: { success: true } }));
    const { wrapper } = setup();
    const { result } = renderHook(() => useExperiences(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});

describe('experience zero price regression', () => {
  test.each([
    [{ minPrice: 0 }, '/api/experiences?minPrice=0'],
    [{ maxPrice: 0 }, '/api/experiences?maxPrice=0'],
    [{ minPrice: 0, maxPrice: 0 }, '/api/experiences?minPrice=0&maxPrice=0'],
  ])('sends every explicit zero bound in %j', async (params, url) => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useExperiences(params), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(url);
  });
});
