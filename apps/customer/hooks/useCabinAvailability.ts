import { useQuery } from '@tanstack/react-query';
import type { ApiResponse } from '@/types';

interface UnavailableRange {
  start: string;
  end: string;
}

interface AvailabilityData {
  unavailableDates: UnavailableRange[];
  queryRange: { start: string; end: string };
}

const fetchAvailability = async (
  cabinId: string
): Promise<AvailabilityData> => {
  const response = await fetch(`/api/cabins/${cabinId}/availability`);
  if (!response.ok)
    throw new Error(`Failed to fetch availability (HTTP ${response.status})`);
  const result: ApiResponse<AvailabilityData> = await response.json();
  if (!result.success || !result.data)
    throw new Error(result.error || 'Failed to fetch availability');
  return result.data;
};

export function useCabinAvailability(cabinId: string) {
  return useQuery({
    enabled: !!cabinId,
    gcTime: 1000 * 60 * 10,
    queryFn: () => fetchAvailability(cabinId),
    queryKey: ['cabin-availability', cabinId],
    staleTime: 1000 * 60 * 5,
  });
}
