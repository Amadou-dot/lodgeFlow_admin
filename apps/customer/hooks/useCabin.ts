import { useQuery } from '@tanstack/react-query';
import type { ApiResponse, Cabin } from '@/types';

const fetchCabin = async (cabinId: string): Promise<Cabin> => {
  const response = await fetch(`/api/cabins/${cabinId}`);

  if (!response.ok) {
    throw new Error('Failed to fetch cabin');
  }

  const result: ApiResponse<Cabin> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch cabin');
  }
  return result.data;
};

export function useCabin(cabinId: string) {
  return useQuery({
    queryKey: ['cabin', cabinId],
    queryFn: () => fetchCabin(cabinId),
    enabled: !!cabinId,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });
}
