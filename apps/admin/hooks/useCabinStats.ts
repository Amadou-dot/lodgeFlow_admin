import { useQuery } from '@tanstack/react-query';

interface CabinStats {
  totalCabins: number;
  totalCapacity: number;
  averagePrice: number;
  cabinsWithDiscount: number;
}

export function useCabinStats() {
  return useQuery<CabinStats>({
    queryKey: ['cabin-stats'],
    queryFn: async () => {
      const response = await fetch('/api/cabins/stats');
      if (!response.ok) {
        throw new Error('Failed to fetch cabin stats');
      }
      const result = await response.json();
      return result.success ? result.data : result;
    },
  });
}
