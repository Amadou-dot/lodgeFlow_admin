import {
  catalogDeleteResponseSchema,
  experienceListResponseSchema,
  experienceResponseSchema,
  readCatalogResponse,
} from '@/lib/validations/catalog-json';
import { experienceEditableFields } from '@/lib/requests/catalog';
import type {
  CreateExperienceInput,
  UpdateExperienceInput,
} from '@/lib/validations/experience';
import type { Experience, ExperienceFilters } from '@/types';
import { displayToast } from '@/utils/toastUtils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useExperiences(filters: ExperienceFilters = {}) {
  const queryParams = new URLSearchParams();

  if (filters.search) queryParams.append('search', filters.search);
  if (filters.category) queryParams.append('category', filters.category);
  if (filters.difficulty) queryParams.append('difficulty', filters.difficulty);
  if (filters.sortBy) queryParams.append('sortBy', filters.sortBy);
  if (filters.sortOrder) queryParams.append('sortOrder', filters.sortOrder);

  return useQuery<Experience[]>({
    queryKey: ['experiences', filters],
    queryFn: async () => {
      const response = await fetch(
        `/api/experiences?${queryParams.toString()}`
      );
      return readCatalogResponse({
        response,
        schema: experienceListResponseSchema,
        fallback: 'Failed to fetch experiences',
      });
    },
  });
}

export function useCreateExperience() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (experience: Partial<CreateExperienceInput>) => {
      const response = await fetch('/api/experiences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(experienceEditableFields(experience)),
      });

      return readCatalogResponse({
        response,
        schema: experienceResponseSchema,
        fallback: 'Failed to create experience',
        failure: message => displayToast(message, 'error'),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['experiences'] });
      queryClient.invalidateQueries({ queryKey: ['experience-stats'] });
      displayToast('Experience created successfully', 'success');
    },
  });
}

export function useUpdateExperience() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (experience: UpdateExperienceInput) => {
      const response = await fetch(`/api/experiences/${experience._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...experienceEditableFields(experience),
          _id: experience._id,
        }),
      });

      return readCatalogResponse({
        response,
        schema: experienceResponseSchema.refine(
          row => row._id.toLowerCase() === experience._id.toLowerCase()
        ),
        fallback: 'Failed to update experience',
        failure: message => displayToast(message, 'error'),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['experiences'] });
      queryClient.invalidateQueries({ queryKey: ['experience-stats'] });
      displayToast('Experience updated successfully', 'success');
    },
  });
}

export function useDeleteExperience() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/experiences/${id}`, {
        method: 'DELETE',
      });

      return readCatalogResponse({
        response,
        schema: catalogDeleteResponseSchema,
        fallback: 'Failed to delete experience',
        failure: 'server-error',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['experiences'] });
      queryClient.invalidateQueries({ queryKey: ['experience-stats'] });
    },
  });
}
