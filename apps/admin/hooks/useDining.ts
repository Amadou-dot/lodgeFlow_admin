import {
  catalogDeleteResponseSchema,
  diningListResponseSchema,
  diningResponseSchema,
  readCatalogResponse,
} from '@/lib/validations/catalog-json';
import { diningEditableFields } from '@/lib/requests/catalog';
import type {
  CreateDiningInput,
  UpdateDiningInput,
} from '@/lib/validations/dining';
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
      return readCatalogResponse({
        response,
        schema: diningListResponseSchema,
        fallback: 'Failed to fetch dining items',
      });
    },
  });
}

export function useCreateDining() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dining: Partial<CreateDiningInput>) => {
      const response = await fetch('/api/dining', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(diningEditableFields(dining)),
      });

      return readCatalogResponse({
        response,
        schema: diningResponseSchema,
        fallback: 'Failed to create dining item',
        failure: message => displayToast(message, 'error'),
      });
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
    mutationFn: async (dining: UpdateDiningInput) => {
      const response = await fetch(`/api/dining/${dining._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...diningEditableFields(dining),
          _id: dining._id,
        }),
      });

      return readCatalogResponse({
        response,
        schema: diningResponseSchema,
        fallback: 'Failed to update dining item',
        failure: message => displayToast(message, 'error'),
      });
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

      return readCatalogResponse({
        response,
        schema: catalogDeleteResponseSchema,
        fallback: 'Failed to delete dining item',
        failure: 'server-error',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dining'] });
      queryClient.invalidateQueries({ queryKey: ['dining-stats'] });
    },
  });
}
