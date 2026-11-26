import {
  cabinBulkDeleteResponseSchema,
  cabinBulkDiscountResponseSchema,
  cabinDeleteResponseSchema,
  cabinListResponseSchema,
  cabinMutationErrorSchema,
  cabinResponseSchema,
} from '@/lib/validations/cabin-json';
import type {
  Cabin,
  CabinFilters,
  CreateCabinData,
  UpdateCabinData,
} from '@/types';
import { displayToast } from '@/utils/toastUtils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ZodType } from 'zod';

function parseResponse<T>({
  body,
  schema,
  fallback,
}: {
  body: unknown;
  schema: ZodType<T>;
  fallback: string;
}): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new Error(fallback);
  return result.data;
}

async function readMutation<T>({
  response,
  schema,
  fallback,
  showErrorToast = false,
}: {
  response: Response;
  schema: ZodType<T>;
  fallback: string;
  showErrorToast?: boolean;
}): Promise<T> {
  const body: unknown = await response.json();
  if (!response.ok) {
    const result = cabinMutationErrorSchema.safeParse(body);
    const error = result.success ? result.data : undefined;
    if (showErrorToast) displayToast(error?.message || fallback, 'error');
    throw new Error(error?.error || fallback);
  }
  return parseResponse({ body, schema, fallback });
}

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
      return parseResponse({
        body: await response.json(),
        schema: cabinListResponseSchema,
        fallback: 'Failed to fetch cabins',
      });
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

      return parseResponse({
        body: await response.json(),
        schema: cabinResponseSchema,
        fallback: 'Failed to fetch cabin',
      });
    },
    enabled: !!id, // Only run query if id is provided
  });
}

export function useCreateCabin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cabin: CreateCabinData): Promise<Cabin> => {
      const response = await fetch('/api/cabins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cabin),
      });

      return readMutation({
        response,
        schema: cabinResponseSchema,
        fallback: 'Failed to create cabin',
        showErrorToast: true,
      });
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
    mutationFn: async (cabin: UpdateCabinData): Promise<Cabin> => {
      const response = await fetch(`/api/cabins/${cabin._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cabin),
      });

      return readMutation({
        response,
        schema: cabinResponseSchema,
        fallback: 'Failed to update cabin',
        showErrorToast: true,
      });
    },
    onSuccess: (_data, cabin) => {
      queryClient.invalidateQueries({ queryKey: ['cabins'] });
      queryClient.invalidateQueries({ queryKey: ['cabin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['cabin', cabin._id] });
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

      return readMutation({
        response,
        schema: cabinDeleteResponseSchema,
        fallback: 'Failed to delete cabin',
      });
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['cabins'] });
      queryClient.invalidateQueries({ queryKey: ['cabin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['cabin', id] });
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

      return readMutation({
        response,
        schema: cabinBulkDeleteResponseSchema,
        fallback: 'Failed to delete cabins',
      });
    },
    onSuccess: (data, ids) => {
      queryClient.invalidateQueries({ queryKey: ['cabins'] });
      queryClient.invalidateQueries({ queryKey: ['cabin-stats'] });
      ids.forEach(id =>
        queryClient.invalidateQueries({ queryKey: ['cabin', id] })
      );
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

      return readMutation({
        response,
        schema: cabinBulkDiscountResponseSchema,
        fallback: 'Failed to update discounts',
      });
    },
    onSuccess: (data, { ids }) => {
      queryClient.invalidateQueries({ queryKey: ['cabins'] });
      queryClient.invalidateQueries({ queryKey: ['cabin-stats'] });
      ids.forEach(id =>
        queryClient.invalidateQueries({ queryKey: ['cabin', id] })
      );
      displayToast(
        `Discount updated for ${data.modifiedCount} cabin${data.modifiedCount === 1 ? '' : 's'}`,
        'success'
      );
    },
  });
}
