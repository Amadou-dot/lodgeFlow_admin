import type { Dining, DiningFilters } from '@/types';
import { displayToast } from '@/utils/toastUtils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useDining(filters: DiningFilters = {}) {
  const queryParams = new URLSearchParams();

  if (filters.type) queryParams.append('type', filters.type);
  if (filters.mealType) queryParams.append('mealType', filters.mealType);
  if (filters.category) queryParams.append('category', filters.category);
  if (filters.isAvailable)
    queryParams.append('isAvailable', filters.isAvailable);
  if (filters.search) queryParams.append('search', filters.search);
  if (filters.sortBy) queryParams.append('sortBy', filters.sortBy);
  if (filters.sortOrder) queryParams.append('sortOrder', filters.sortOrder);

  return useQuery<Dining[]>({
    queryKey: ['dining', filters],
    queryFn: async () => {
      const response = await fetch(`/api/dining?${queryParams.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch dining items');
      }
      const result = await response.json();
      return result.success ? result.data : result;
    },
  });
}

export function useCreateDining() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dining: Partial<Dining>) => {
      const response = await fetch('/api/dining', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dining),
      });

      if (!response.ok) {
        const error = await response.json();
        displayToast(error.message || 'Failed to create dining item', 'error');
        throw new Error(error.error || 'Failed to create dining item');
      }

      const result = await response.json();
      return result.success ? result.data : result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dining'] });
      queryClient.invalidateQueries({ queryKey: ['dining-stats'] });
      displayToast('Dining item created successfully', 'success');
    },
  });
}

export function useUpdateDining() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dining: Partial<Dining> & { _id: string }) => {
      const response = await fetch(`/api/dining/${dining._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dining),
      });

      if (!response.ok) {
        const error = await response.json();
        displayToast(error.message || 'Failed to update dining item', 'error');
        throw new Error(error.error || 'Failed to update dining item');
      }

      const result = await response.json();
      return result.success ? result.data : result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dining'] });
      queryClient.invalidateQueries({ queryKey: ['dining-stats'] });
      displayToast('Dining item updated successfully', 'success');
    },
  });
}

export function useDeleteDining() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/dining/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete dining item');
      }

      const result = await response.json();
      return result.success ? result : result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dining'] });
      queryClient.invalidateQueries({ queryKey: ['dining-stats'] });
    },
  });
}
