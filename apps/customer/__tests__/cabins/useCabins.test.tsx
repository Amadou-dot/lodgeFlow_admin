import { renderHook, waitFor } from '@testing-library/react';
import { useCabins } from '@/hooks/useCabins';
import { createTestQueryClient } from '@/__tests__/shared/test-utils';
import { QueryClientProvider } from '@tanstack/react-query';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={createTestQueryClient()}>
    {children}
  </QueryClientProvider>
);

describe('useCabins', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('fetches all cabins without parameters', async () => {
    const mockCabins = [
      { _id: '1', name: 'Cabin 1', maxCapacity: 4, regularPrice: 200 },
      { _id: '2', name: 'Cabin 2', maxCapacity: 2, regularPrice: 150 },
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockCabins }),
    });

    const { result } = renderHook(() => useCabins(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(global.fetch).toHaveBeenCalledWith('/api/cabins');
    expect(result.current.data).toEqual(mockCabins);
  });

  it('fetches cabins with capacity filter', async () => {
    const mockCabins = [
      { _id: '1', name: 'Large Cabin', maxCapacity: 4, regularPrice: 200 },
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockCabins }),
    });

    const { result } = renderHook(() => useCabins({ capacity: 4 }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(global.fetch).toHaveBeenCalledWith('/api/cabins?capacity=4');
  });

  it('fetches cabins with price range filters', async () => {
    const mockCabins = [
      { _id: '1', name: 'Mid-Range Cabin', regularPrice: 175 },
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockCabins }),
    });

    const { result } = renderHook(
      () => useCabins({ minPrice: 150, maxPrice: 200 }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/cabins?minPrice=150&maxPrice=200'
    );
  });

  it('fetches cabins with availability filter', async () => {
    const mockCabins = [
      { _id: '1', name: 'Available Cabin', regularPrice: 200 },
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockCabins }),
    });

    const { result } = renderHook(() => useCabins({ available: true }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(global.fetch).toHaveBeenCalledWith('/api/cabins?available=true');
  });

  it('fetches cabins with search query', async () => {
    const mockCabins = [{ _id: '1', name: 'Luxury Suite', regularPrice: 300 }];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockCabins }),
    });

    const { result } = renderHook(() => useCabins({ search: 'luxury' }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(global.fetch).toHaveBeenCalledWith('/api/cabins?search=luxury');
  });

  it('fetches cabins with multiple filters', async () => {
    const mockCabins = [{ _id: '1', name: 'Perfect Match', regularPrice: 180 }];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockCabins }),
    });

    const { result } = renderHook(
      () =>
        useCabins({
          capacity: 2,
          minPrice: 150,
          maxPrice: 200,
          available: true,
          search: 'cozy',
        }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/cabins?capacity=2&minPrice=150&maxPrice=200&available=true&search=cozy'
    );
  });

  it('handles fetch errors', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
    });

    const { result } = renderHook(() => useCabins(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeTruthy();
  });

  it('handles API errors with error message', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: false, error: 'Database error' }),
    });

    const { result } = renderHook(() => useCabins(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Database error');
  });

  it('handles API errors without error message', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: false }),
    });

    const { result } = renderHook(() => useCabins(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Failed to fetch cabins');
  });

  it('returns empty array when data is null', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: null }),
    });

    const { result } = renderHook(() => useCabins(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('caches data with correct staleTime', async () => {
    const mockCabins = [{ _id: '1', name: 'Cabin 1' }];

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockCabins }),
    });

    const { result, rerender } = renderHook(() => useCabins(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Rerender should use cached data
    rerender();

    // Fetch should have been called only once due to caching
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
