import { useDiningItem } from '@/hooks/useDiningItem';
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
  test.each([
    [
      'unreadable JSON',
      async () => {
        throw new SyntaxError('Invalid JSON');
      },
    ],
    ['false data', async () => ({ success: true, data: false })],
    ['a nonliteral success flag', async () => ({ success: 1, data: null })],
    ['a false success with data', async () => ({ success: false, data: [] })],
  ] as const)('rejects %s before caching', async (_label, json) => {
    const { wrapper } = setup();
    fetchMock.mockResolvedValue({ ok: true, json });
    const { result } = renderHook(() => useDining(), { wrapper });
    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(result.current.error?.message).toBe(
      'Failed to fetch dining options'
    );
    expect(result.current.data).toBeUndefined();
  });
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

  test.each([{}, { data: null }])(
    'preserves empty success for nullish data (%j)',
    async fields => {
      fetchMock.mockResolvedValue(
        response({ body: { success: true, ...fields } })
      );
      const { wrapper } = setup();
      const { result } = renderHook(() => useDining(), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([]);
    }
  );
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

const id = '507f1f77bcf86cd7994390ab';
const lean = {
  _id: id,
  name: 'Soup',
  description: 'Local vegetables',
  type: 'menu',
  mealType: 'lunch',
  category: 'regular',
  image: '/soup',
  price: 12.345,
  maxPeople: 4.5,
  servingTime: { start: 'Noon', end: 'Late', extra: { origin: 'import' } },
  beverages: [
    { name: 'Juice', category: 'non-alcoholic', extra: { source: true } },
  ],
  gallery: null,
  imported: { values: [1, null] },
};
test('caches the sparse detail including nested additive fields under its requested ID', async () => {
  fetchMock.mockResolvedValue(
    response({ body: { success: true, data: lean } })
  );
  const { wrapper, client } = setup();
  const { result } = renderHook(() => useDiningItem(id.toUpperCase()), {
    wrapper,
  });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toBe(lean);
  expect(client.getQueryData(['dining-item', id.toUpperCase()])).toStrictEqual(
    lean
  );
});
test.each([
  { success: true, data: { ...lean, _id: '507f1f77bcf86cd7994390ac' } },
  { success: true, data: { ...lean, price: 'free' } },
  { success: 'true', data: lean },
  { success: true, data: null },
])('rejects an invalid detail before caching (%j)', async body => {
  fetchMock.mockResolvedValue(response({ body }));
  const { wrapper, client } = setup();
  const { result } = renderHook(() => useDiningItem(id), { wrapper });
  await waitFor(() => expect(result.current.isFetching).toBe(false));
  expect(result.current.error?.message).toBe('Failed to fetch dining item');
  expect(client.getQueryData(['dining-item', id])).toBeUndefined();
});
test('rejects a sparse detail returned as a hydrated list row', async () => {
  fetchMock.mockResolvedValue(
    response({ body: { success: true, data: [lean] } })
  );
  const { wrapper, client } = setup();
  const { result } = renderHook(() => useDining(), { wrapper });
  await waitFor(() => expect(result.current.isFetching).toBe(false));
  expect(result.current.error?.message).toBe('Failed to fetch dining options');
  expect(client.getQueryData(['dining', {}])).toBeUndefined();
});
