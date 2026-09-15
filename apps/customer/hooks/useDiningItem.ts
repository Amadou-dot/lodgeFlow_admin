import { useQuery } from '@tanstack/react-query';

import type { ApiResponse, Dining } from '@/types';

/**
 * Hook to fetch a single dining item by ID
 */
export const useDiningItem = (diningId: string) => {
  return useQuery({
    enabled: !!diningId,
    queryFn: async (): Promise<Dining | null> => {
      const response = await fetch(`/api/dining/${diningId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch dining item');
      }

      const data: ApiResponse<Dining> = await response.json();
      return data.data || null;
    },
    queryKey: ['dining-item', diningId],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};
