import type {
  Cabin,
  CabinFilters,
  CreateCabinData,
  UpdateCabinData,
} from '@/types';
import { displayToast } from '@/utils/toastUtils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useCabins(filters: CabinFilters = {}) {
  const queryParams = new URLSearchParams();

  if (filters.filter) queryParams.append('filter', filters.filter);
  if (filters.search) queryParams.append('search', filters.search);
  if (filters.capacity) queryParams.append('capacity', filters.capacity);
  if (filters.discount) queryParams.append('discount', filters.discount);
  if (filters.status) queryParams.append('status', filters.status);
  if (filters.sortBy) queryParams.append('sortBy', filters.sortBy);
  if (filters.sortOrder) queryParams.append('sortOrder', filters.sortOrder);

  return useQuery<Cabin[]>({
    queryKey: ['cabins', filters],
    queryFn: async () => {
      const response = await fetch(`/api/cabins?${queryParams.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch cabins');
      }
      const result = await response.json();
      return result.success ? result.data : result; // Handle both old and new format
    },
  });
}

export function useCabin(id: string) {
  return useQuery<Cabin>({
    queryKey: ['cabin', id],
    queryFn: async () => {
      if (!id) {
        throw new Error('Cabin ID is required');
      }

      const response = await fetch(`/api/cabins/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch cabin');
      }

      const result = await response.json();
      return result.success ? result.data : result;
    },
    enabled: !!id, // Only run query if id is provided
  });
}

export function useCreateCabin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cabin: CreateCabinData) => {
      const response = await fetch('/api/cabins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cabin),
      });

      if (!response.ok) {
        const error = await response.json();
        displayToast(error.message || 'Failed to create cabin', 'error');
        throw new Error(error.error || 'Failed to create cabin');
      }

      const result = await response.json();
      return result.success ? result.data : result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cabins'] });
      queryClient.invalidateQueries({ queryKey: ['cabin-stats'] });
      displayToast('Cabin created successfully', 'success');
    },
  });
}

export function useUpdateCabin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cabin: UpdateCabinData) => {
      const response = await fetch(`/api/cabins/${cabin._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cabin),
      });

      if (!response.ok) {
        const error = await response.json();
        displayToast(error.message || 'Failed to update cabin', 'error');
        throw new Error(error.error || 'Failed to update cabin');
      }

      const result = await response.json();
      return result.success ? result.data : result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cabins'] });
      queryClient.invalidateQueries({ queryKey: ['cabin-stats'] });
      displayToast('Cabin updated successfully', 'success');
    },
  });
}

export function useDeleteCabin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/cabins/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete cabin');
      }

      const result = await response.json();
      return result.success ? result : result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cabins'] });
      queryClient.invalidateQueries({ queryKey: ['cabin-stats'] });
    },
  });
}

export function useBulkDeleteCabins() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const response = await fetch('/api/cabins/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', ids }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete cabins');
      }

      const result = await response.json();
      return result.data;
    },
    onSuccess: (data: { deletedCount: number }) => {
      queryClient.invalidateQueries({ queryKey: ['cabins'] });
      queryClient.invalidateQueries({ queryKey: ['cabin-stats'] });
      displayToast(
        `${data.deletedCount} cabin${data.deletedCount === 1 ? '' : 's'} deleted`,
        'success'
      );
    },
  });
}

export function useBulkUpdateDiscount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      ids,
      discount,
    }: {
      ids: string[];
      discount: number;
    }) => {
      const response = await fetch('/api/cabins/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-discount', ids, discount }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update discounts');
      }

      const result = await response.json();
      return result.data;
    },
    onSuccess: (data: { modifiedCount: number }) => {
      queryClient.invalidateQueries({ queryKey: ['cabins'] });
      queryClient.invalidateQueries({ queryKey: ['cabin-stats'] });
      displayToast(
        `Discount updated for ${data.modifiedCount} cabin${data.modifiedCount === 1 ? '' : 's'}`,
        'success'
      );
    },
  });
}
