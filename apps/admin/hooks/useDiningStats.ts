import { useQuery } from '@tanstack/react-query';

interface DiningStats {
  totalItems: number;
  menuCount: number;
  experienceCount: number;
  averagePrice: number;
  availableItems: number;
}

export function useDiningStats() {
  return useQuery<DiningStats>({
    queryKey: ['dining-stats'],
    queryFn: async () => {
      const response = await fetch('/api/dining/stats');
      if (!response.ok) {
        throw new Error('Failed to fetch dining stats');
      }
      const result = await response.json();
      return result.success ? result.data : result;
    },
  });
}
