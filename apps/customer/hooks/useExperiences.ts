import {
  readCatalogResponse,
  experienceListSchema,
} from '@/lib/validations/catalog-json';
import { useQuery } from '@tanstack/react-query';
import type { Experience, ExperienceQueryParams } from '@/types';

const fetchExperiences = async (
  params: ExperienceQueryParams = {}
): Promise<Experience[]> => {
  const searchParams = new URLSearchParams();

  if (params.category) searchParams.append('category', params.category);
  if (params.difficulty) searchParams.append('difficulty', params.difficulty);
  if (params.minPrice !== undefined)
    searchParams.append('minPrice', params.minPrice.toString());
  if (params.maxPrice !== undefined)
    searchParams.append('maxPrice', params.maxPrice.toString());
  if (params.isPopular !== undefined)
    searchParams.append('isPopular', params.isPopular.toString());
  if (params.tags?.length) searchParams.append('tags', params.tags.join(','));

  const url = `/api/experiences${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const response = await fetch(url);

  return readCatalogResponse({
    response,
    schema: experienceListSchema,
    fallback: 'Failed to fetch experiences',
  });
};

export function useExperiences(params: ExperienceQueryParams = {}) {
  return useQuery({
    queryKey: ['experiences', params],
    queryFn: () => fetchExperiences(params),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}
