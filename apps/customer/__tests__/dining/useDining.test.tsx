import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useDining } from '@/hooks/useDining';
import type { DiningQueryParams } from '@/types';
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

describe('dining hook characterization', () => {
  test('uses the existing unfiltered URL and success data', async () => {
    const { wrapper, client } = setup();
    const { result } = renderHook(() => useDining(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith('/api/dining');
    expect(client.getQueryData(['dining', {}])).toEqual([]);
  });

  test('encodes all existing filter values, including false popularity', async () => {
    const { wrapper } = setup();
    const { result } = renderHook(
      () =>
        useDining({
          type: 'menu',
          mealType: 'dinner',
          category: 'regular',
          minPrice: 10,
          maxPrice: 40,
          isPopular: false,
          dietary: ['vegan', 'vegetarian'],
          search: 'Forest|vegan',
        }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/dining?type=menu&mealType=dinner&category=regular&isPopular=false&minPrice=10&maxPrice=40&dietary=vegan%2Cvegetarian&search=Forest%7Cvegan'
    );
  });

  test('keeps independent range caches and reuses a fresh matching query', async () => {
    const { wrapper, client } = setup();
    const first: DiningQueryParams = { maxPrice: 10 };
    const second: DiningQueryParams = { maxPrice: 40 };
    const { result, rerender } = renderHook(
      (params: DiningQueryParams) => useDining(params),
      { wrapper, initialProps: first }
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    rerender(second);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(client.getQueryData(['dining', first])).toEqual([]);
    expect(client.getQueryData(['dining', second])).toEqual([]);
    rerender({ ...first });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      client.getQueryCache().find({ queryKey: ['dining', first] })?.options
        .gcTime
    ).toBe(600000);
  });

  test.each([
    [false, { success: true, data: [] }, 'Failed to fetch dining options'],
    [
      true,
      { success: false, error: 'Catalog unavailable' },
      'Catalog unavailable',
    ],
    [true, { success: false }, 'Failed to fetch dining options'],
  ])(
    'preserves request/envelope errors (%s, %j)',
    async (ok, body, message) => {
      fetchMock.mockResolvedValue(response({ ok, body }));
      const { wrapper } = setup();
      const { result } = renderHook(() => useDining(), { wrapper });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe(message);
    }
  );

  test('preserves the empty fallback for an omitted data field', async () => {
    fetchMock.mockResolvedValue(response({ body: { success: true } }));
    const { wrapper } = setup();
    const { result } = renderHook(() => useDining(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});

describe('dining zero price regression', () => {
  test.each([
    [{ minPrice: 0 }, '/api/dining?minPrice=0'],
    [{ maxPrice: 0 }, '/api/dining?maxPrice=0'],
    [{ minPrice: 0, maxPrice: 0 }, '/api/dining?minPrice=0&maxPrice=0'],
  ])('sends every explicit zero bound in %j', async (params, url) => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useDining(params), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(url);
  });
});
