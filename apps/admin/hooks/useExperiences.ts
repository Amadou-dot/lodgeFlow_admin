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
      if (!response.ok) {
        throw new Error('Failed to fetch experiences');
      }
      const result = await response.json();
      return result.success ? result.data : result;
    },
  });
}

export function useCreateExperience() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (experience: Partial<Experience>) => {
      const response = await fetch('/api/experiences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(experience),
      });

      if (!response.ok) {
        const error = await response.json();
        displayToast(error.message || 'Failed to create experience', 'error');
        throw new Error(error.error || 'Failed to create experience');
      }

      const result = await response.json();
      return result.success ? result.data : result;
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
    mutationFn: async (experience: Partial<Experience> & { _id: string }) => {
      const response = await fetch(`/api/experiences/${experience._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(experience),
      });

      if (!response.ok) {
        const error = await response.json();
        displayToast(error.message || 'Failed to update experience', 'error');
        throw new Error(error.error || 'Failed to update experience');
      }

      const result = await response.json();
      return result.success ? result.data : result;
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

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete experience');
      }

      const result = await response.json();
      return result.success ? result : result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['experiences'] });
      queryClient.invalidateQueries({ queryKey: ['experience-stats'] });
    },
  });
}
