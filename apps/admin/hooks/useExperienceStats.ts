import { useQuery } from '@tanstack/react-query';

interface ExperienceStats {
  totalExperiences: number;
  averagePrice: number;
  popularCount: number;
  totalCapacity: number;
}

export function useExperienceStats() {
  return useQuery<ExperienceStats>({
    queryKey: ['experience-stats'],
    queryFn: async () => {
      const response = await fetch('/api/experiences/stats');
      if (!response.ok) {
        throw new Error('Failed to fetch experience stats');
      }
      const result = await response.json();
      return result.success ? result.data : result;
    },
  });
}
