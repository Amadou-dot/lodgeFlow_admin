import {
  readCatalogResponse,
  experienceDetailSchema,
} from '@/lib/validations/catalog-json';
import { useQuery } from '@tanstack/react-query';
import type { Experience } from '@/types';

const fetchExperience = async (experienceId: string): Promise<Experience> => {
  const response = await fetch(`/api/experiences/${experienceId}`);

  return readCatalogResponse({
    response,
    schema: experienceDetailSchema(experienceId),
    fallback: 'Failed to fetch experience',
  });
};

export function useExperience(experienceId: string) {
  return useQuery({
    queryKey: ['experience', experienceId],
    queryFn: () => fetchExperience(experienceId),
    enabled: !!experienceId, // Only run query if experienceId exists
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}
