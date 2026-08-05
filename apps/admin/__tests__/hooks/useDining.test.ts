// Mock @tanstack/react-query before imports
let capturedQueryConfig: any = null;
let capturedMutationConfig: any = null;

const mockInvalidateQueries = jest.fn();
const mockQueryClient = { invalidateQueries: mockInvalidateQueries };

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn((config: any) => {
    capturedQueryConfig = config;
    return {
      data: undefined,
      error: undefined,
      isLoading: true,
      isFetching: false,
      refetch: jest.fn(),
    };
  }),
  useMutation: jest.fn((config: any) => {
    capturedMutationConfig = config;
    return {
      mutate: jest.fn(),
      mutateAsync: jest.fn(),
      isPending: false,
      isError: false,
      isSuccess: false,
      reset: jest.fn(),
    };
  }),
  useQueryClient: jest.fn(() => mockQueryClient),
}));

jest.mock('@heroui/toast', () => ({
  addToast: jest.fn(),
}));

import { addToast } from '@heroui/toast';
import {
  useDining,
  useCreateDining,
  useUpdateDining,
  useDeleteDining,
} from '@/hooks/useDining';

beforeEach(() => {
  capturedQueryConfig = null;
  capturedMutationConfig = null;
  jest.clearAllMocks();
  (global.fetch as jest.Mock) = jest.fn();
});

describe('useDining', () => {
  it('uses dining query key with filters', () => {
    const filters = { type: 'breakfast', search: 'pancake' };
    useDining(filters);

    expect(capturedQueryConfig.queryKey).toEqual(['dining', filters]);
  });

  it('uses empty filters by default', () => {
    useDining();

    expect(capturedQueryConfig.queryKey).toEqual(['dining', {}]);
  });

  it('builds URL with type filter', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: [] }),
    });

    useDining({ type: 'breakfast' });
    await capturedQueryConfig.queryFn();

    const fetchUrl = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(fetchUrl).toContain('type=breakfast');
  });

  it('builds URL with mealType filter', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: [] }),
    });

    useDining({ mealType: 'main' });
    await capturedQueryConfig.queryFn();

    const fetchUrl = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(fetchUrl).toContain('mealType=main');
  });

  it('builds URL with category filter', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: [] }),
    });

    useDining({ category: 'dessert' });
    await capturedQueryConfig.queryFn();

    const fetchUrl = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(fetchUrl).toContain('category=dessert');
  });

  it('builds URL with isAvailable filter', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: [] }),
    });

    useDining({ isAvailable: 'true' });
    await capturedQueryConfig.queryFn();

    const fetchUrl = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(fetchUrl).toContain('isAvailable=true');
  });

  it('builds URL with sort params', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: [] }),
    });

    useDining({ sortBy: 'price', sortOrder: 'asc' });
    await capturedQueryConfig.queryFn();

    const fetchUrl = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(fetchUrl).toContain('sortBy=price');
    expect(fetchUrl).toContain('sortOrder=asc');
  });

  it('returns data from success response', async () => {
    const mockItems = [{ _id: '1', name: 'Pancakes' }];
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockItems }),
    });

    useDining();
    const result = await capturedQueryConfig.queryFn();

    expect(result).toEqual(mockItems);
  });

  it('throws on non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

    useDining();

    await expect(capturedQueryConfig.queryFn()).rejects.toThrow(
      'Failed to fetch dining items'
    );
  });
});

describe('useCreateDining', () => {
  it('sends POST to /api/dining', async () => {
    const newItem = { name: 'New Dish', price: 15 };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ success: true, data: { _id: '1', ...newItem } }),
    });

    useCreateDining();
    await capturedMutationConfig.mutationFn(newItem);

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/dining',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(newItem),
      })
    );
  });

  it('invalidates dining and dining-stats on success', () => {
    useCreateDining();
    capturedMutationConfig.onSuccess();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['dining'],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['dining-stats'],
    });
  });

  it('shows success toast on creation', () => {
    useCreateDining();
    capturedMutationConfig.onSuccess();

    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        color: 'success',
        description: 'Dining item created successfully',
      })
    );
  });

  it('shows error toast and throws on failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Validation failed' }),
    });

    useCreateDining();

    await expect(
      capturedMutationConfig.mutationFn({ name: 'Bad' })
    ).rejects.toThrow('Validation failed');

    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'danger' })
    );
  });
});

describe('useUpdateDining', () => {
  it('sends PUT request with dining id', async () => {
    const updated = { _id: 'abc123', name: 'Updated Dish', price: 20 };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: updated }),
    });

    useUpdateDining();
    await capturedMutationConfig.mutationFn(updated);

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/dining/abc123',
      expect.objectContaining({ method: 'PUT' })
    );
  });

  it('invalidates queries on success', () => {
    useUpdateDining();
    capturedMutationConfig.onSuccess();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['dining'],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['dining-stats'],
    });
  });
});

describe('useDeleteDining', () => {
  it('sends DELETE request with id', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    useDeleteDining();
    await capturedMutationConfig.mutationFn('abc123');

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/dining/abc123',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('throws on error response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Item has dependencies' }),
    });

    useDeleteDining();

    await expect(capturedMutationConfig.mutationFn('abc123')).rejects.toThrow(
      'Item has dependencies'
    );
  });

  it('invalidates queries on success', () => {
    useDeleteDining();
    capturedMutationConfig.onSuccess();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['dining'],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['dining-stats'],
    });
  });
});
