import { useQuery } from '@tanstack/react-query';
import type { Experience, ApiResponse } from '@/types';

const fetchExperience = async (experienceId: string): Promise<Experience> => {
  const response = await fetch(`/api/experiences/${experienceId}`);

  if (!response.ok) {
    throw new Error('Failed to fetch experience');
  }

  const result: ApiResponse<Experience> = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch experience');
  }

  return result.data!;
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
