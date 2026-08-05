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
  useCabins,
  useCabin,
  useCreateCabin,
  useUpdateCabin,
  useDeleteCabin,
  useBulkDeleteCabins,
  useBulkUpdateDiscount,
} from '@/hooks/useCabins';

beforeEach(() => {
  capturedQueryConfig = null;
  capturedMutationConfig = null;
  jest.clearAllMocks();
  (global.fetch as jest.Mock) = jest.fn();
});

describe('useCabins', () => {
  it('uses cabins query key with filters', () => {
    const filters = { search: 'lake', status: 'active' };
    useCabins(filters);

    expect(capturedQueryConfig.queryKey).toEqual(['cabins', filters]);
  });

  it('uses empty filters by default', () => {
    useCabins();

    expect(capturedQueryConfig.queryKey).toEqual(['cabins', {}]);
  });

  it('builds URL with filter params', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: [] }),
    });

    useCabins({ search: 'lake', status: 'active', sortBy: 'price' });
    await capturedQueryConfig.queryFn();

    const fetchUrl = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(fetchUrl).toContain('search=lake');
    expect(fetchUrl).toContain('status=active');
    expect(fetchUrl).toContain('sortBy=price');
  });

  it('includes capacity filter in URL', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: [] }),
    });

    useCabins({ capacity: '4' });
    await capturedQueryConfig.queryFn();

    const fetchUrl = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(fetchUrl).toContain('capacity=4');
  });

  it('includes discount filter in URL', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: [] }),
    });

    useCabins({ discount: 'with-discount' });
    await capturedQueryConfig.queryFn();

    const fetchUrl = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(fetchUrl).toContain('discount=with-discount');
  });

  it('returns data from success response', async () => {
    const mockCabins = [{ _id: '1', name: 'Lake Cabin' }];
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockCabins }),
    });

    useCabins();
    const result = await capturedQueryConfig.queryFn();

    expect(result).toEqual(mockCabins);
  });

  it('throws on non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
    });

    useCabins();

    await expect(capturedQueryConfig.queryFn()).rejects.toThrow(
      'Failed to fetch cabins'
    );
  });
});

describe('useCabin', () => {
  it('uses cabin query key with id', () => {
    useCabin('abc123');

    expect(capturedQueryConfig.queryKey).toEqual(['cabin', 'abc123']);
  });

  it('is disabled when id is empty', () => {
    useCabin('');

    expect(capturedQueryConfig.enabled).toBe(false);
  });

  it('is enabled when id is provided', () => {
    useCabin('abc123');

    expect(capturedQueryConfig.enabled).toBe(true);
  });

  it('fetches cabin by id', async () => {
    const mockCabin = { _id: 'abc123', name: 'Mountain Lodge' };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockCabin }),
    });

    useCabin('abc123');
    const result = await capturedQueryConfig.queryFn();

    expect(global.fetch).toHaveBeenCalledWith('/api/cabins/abc123');
    expect(result).toEqual(mockCabin);
  });

  it('throws when id is empty in queryFn', async () => {
    useCabin('');

    await expect(capturedQueryConfig.queryFn()).rejects.toThrow(
      'Cabin ID is required'
    );
  });
});

describe('useCreateCabin', () => {
  it('sends POST request to /api/cabins', async () => {
    const newCabin = { name: 'New Cabin', price: 200, capacity: 4 };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ success: true, data: { _id: '1', ...newCabin } }),
    });

    useCreateCabin();
    await capturedMutationConfig.mutationFn(newCabin);

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/cabins',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCabin),
      })
    );
  });

  it('throws and shows toast on error response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Cabin name already exists' }),
    });

    useCreateCabin();

    await expect(
      capturedMutationConfig.mutationFn({ name: 'Duplicate' })
    ).rejects.toThrow('Cabin name already exists');

    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'danger' })
    );
  });

  it('invalidates cabins and cabin-stats queries on success', () => {
    useCreateCabin();
    capturedMutationConfig.onSuccess();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['cabins'],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['cabin-stats'],
    });
  });

  it('shows success toast on creation', () => {
    useCreateCabin();
    capturedMutationConfig.onSuccess();

    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        color: 'success',
        description: 'Cabin created successfully',
      })
    );
  });
});

describe('useUpdateCabin', () => {
  it('sends PUT request with cabin id', async () => {
    const updatedCabin = { _id: 'abc123', name: 'Updated Cabin', price: 300 };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: updatedCabin }),
    });

    useUpdateCabin();
    await capturedMutationConfig.mutationFn(updatedCabin);

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/cabins/abc123',
      expect.objectContaining({ method: 'PUT' })
    );
  });

  it('invalidates queries on success', () => {
    useUpdateCabin();
    capturedMutationConfig.onSuccess();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['cabins'],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['cabin-stats'],
    });
  });
});

describe('useDeleteCabin', () => {
  it('sends DELETE request with cabin id', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    useDeleteCabin();
    await capturedMutationConfig.mutationFn('abc123');

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/cabins/abc123',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('throws on error response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Cabin has active bookings' }),
    });

    useDeleteCabin();

    await expect(capturedMutationConfig.mutationFn('abc123')).rejects.toThrow(
      'Cabin has active bookings'
    );
  });

  it('invalidates queries on success', () => {
    useDeleteCabin();
    capturedMutationConfig.onSuccess();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['cabins'],
    });
  });
});

describe('useBulkDeleteCabins', () => {
  it('sends POST with delete action and ids', async () => {
    const ids = ['id1', 'id2', 'id3'];
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { deletedCount: 3 } }),
    });

    useBulkDeleteCabins();
    await capturedMutationConfig.mutationFn(ids);

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/cabins/bulk',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'delete', ids }),
      })
    );
  });

  it('shows toast with correct count on success', () => {
    useBulkDeleteCabins();
    capturedMutationConfig.onSuccess({ deletedCount: 3 });

    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: '3 cabins deleted',
        color: 'success',
      })
    );
  });

  it('uses singular form for single deletion', () => {
    useBulkDeleteCabins();
    capturedMutationConfig.onSuccess({ deletedCount: 1 });

    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: '1 cabin deleted',
      })
    );
  });
});

describe('useBulkUpdateDiscount', () => {
  it('sends POST with update-discount action', async () => {
    const ids = ['id1', 'id2'];
    const discount = 15;
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ success: true, data: { modifiedCount: 2 } }),
    });

    useBulkUpdateDiscount();
    await capturedMutationConfig.mutationFn({ ids, discount });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/cabins/bulk',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'update-discount', ids, discount }),
      })
    );
  });

  it('shows toast with correct count on success', () => {
    useBulkUpdateDiscount();
    capturedMutationConfig.onSuccess({ modifiedCount: 2 });

    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Discount updated for 2 cabins',
        color: 'success',
      })
    );
  });
});
