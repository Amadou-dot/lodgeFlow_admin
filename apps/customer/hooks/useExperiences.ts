import { useQuery } from '@tanstack/react-query';
import type { Experience, ExperienceQueryParams, ApiResponse } from '@/types';

const fetchExperiences = async (
  params: ExperienceQueryParams = {}
): Promise<Experience[]> => {
  const searchParams = new URLSearchParams();

  if (params.category) searchParams.append('category', params.category);
  if (params.difficulty) searchParams.append('difficulty', params.difficulty);
  if (params.minPrice)
    searchParams.append('minPrice', params.minPrice.toString());
  if (params.maxPrice)
    searchParams.append('maxPrice', params.maxPrice.toString());
  if (params.isPopular !== undefined)
    searchParams.append('isPopular', params.isPopular.toString());
  if (params.tags?.length) searchParams.append('tags', params.tags.join(','));

  const url = `/api/experiences${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to fetch experiences');
  }

  const result: ApiResponse<Experience[]> = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch experiences');
  }

  return result.data || [];
};

export function useExperiences(params: ExperienceQueryParams = {}) {
  return useQuery({
    queryKey: ['experiences', params],
    queryFn: () => fetchExperiences(params),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}
