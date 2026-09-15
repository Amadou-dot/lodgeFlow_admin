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
  useExperiences,
  useCreateExperience,
  useUpdateExperience,
  useDeleteExperience,
} from '@/hooks/useExperiences';

beforeEach(() => {
  capturedQueryConfig = null;
  capturedMutationConfig = null;
  jest.clearAllMocks();
  (global.fetch as jest.Mock) = jest.fn();
});

describe('useExperiences', () => {
  it('uses experiences query key with filters', () => {
    const filters = { category: 'outdoor', difficulty: 'Easy' };
    useExperiences(filters);

    expect(capturedQueryConfig.queryKey).toEqual(['experiences', filters]);
  });

  it('uses empty filters by default', () => {
    useExperiences();

    expect(capturedQueryConfig.queryKey).toEqual(['experiences', {}]);
  });

  it('builds URL with search filter', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: [] }),
    });

    useExperiences({ search: 'hiking' });
    await capturedQueryConfig.queryFn();

    const fetchUrl = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(fetchUrl).toContain('search=hiking');
  });

  it('builds URL with category filter', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: [] }),
    });

    useExperiences({ category: 'outdoor' });
    await capturedQueryConfig.queryFn();

    const fetchUrl = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(fetchUrl).toContain('category=outdoor');
  });

  it('builds URL with difficulty filter', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: [] }),
    });

    useExperiences({ difficulty: 'Challenging' });
    await capturedQueryConfig.queryFn();

    const fetchUrl = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(fetchUrl).toContain('difficulty=Challenging');
  });

  it('builds URL with sort params', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: [] }),
    });

    useExperiences({ sortBy: 'price', sortOrder: 'desc' });
    await capturedQueryConfig.queryFn();

    const fetchUrl = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(fetchUrl).toContain('sortBy=price');
    expect(fetchUrl).toContain('sortOrder=desc');
  });

  it('returns data from success response', async () => {
    const mockExperiences = [{ _id: '1', name: 'Mountain Hike' }];
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockExperiences }),
    });

    useExperiences();
    const result = await capturedQueryConfig.queryFn();

    expect(result).toEqual(mockExperiences);
  });

  it('throws on non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

    useExperiences();

    await expect(capturedQueryConfig.queryFn()).rejects.toThrow(
      'Failed to fetch experiences'
    );
  });
});

describe('useCreateExperience', () => {
  it('sends POST to /api/experiences', async () => {
    const newExp = { name: 'Kayaking', price: 75 };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ success: true, data: { _id: '1', ...newExp } }),
    });

    useCreateExperience();
    await capturedMutationConfig.mutationFn(newExp);

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/experiences',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(newExp),
      })
    );
  });

  it('invalidates experiences and experience-stats on success', () => {
    useCreateExperience();
    capturedMutationConfig.onSuccess();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['experiences'],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['experience-stats'],
    });
  });

  it('shows success toast on creation', () => {
    useCreateExperience();
    capturedMutationConfig.onSuccess();

    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        color: 'success',
        description: 'Experience created successfully',
      })
    );
  });

  it('shows error toast and throws on failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Missing required fields' }),
    });

    useCreateExperience();

    await expect(
      capturedMutationConfig.mutationFn({ name: 'Bad' })
    ).rejects.toThrow('Missing required fields');

    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'danger' })
    );
  });
});

describe('useUpdateExperience', () => {
  it('sends PUT request with experience id', async () => {
    const updated = { _id: 'exp123', name: 'Updated Hike', price: 100 };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: updated }),
    });

    useUpdateExperience();
    await capturedMutationConfig.mutationFn(updated);

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/experiences/exp123',
      expect.objectContaining({ method: 'PUT' })
    );
  });

  it('invalidates queries on success', () => {
    useUpdateExperience();
    capturedMutationConfig.onSuccess();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['experiences'],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['experience-stats'],
    });
  });

  it('shows success toast on update', () => {
    useUpdateExperience();
    capturedMutationConfig.onSuccess();

    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        color: 'success',
        description: 'Experience updated successfully',
      })
    );
  });
});

describe('useDeleteExperience', () => {
  it('sends DELETE request with id', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    useDeleteExperience();
    await capturedMutationConfig.mutationFn('exp123');

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/experiences/exp123',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('throws on error response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Cannot delete' }),
    });

    useDeleteExperience();

    await expect(capturedMutationConfig.mutationFn('exp123')).rejects.toThrow(
      'Cannot delete'
    );
  });

  it('invalidates queries on success', () => {
    useDeleteExperience();
    capturedMutationConfig.onSuccess();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['experiences'],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['experience-stats'],
    });
  });
});
