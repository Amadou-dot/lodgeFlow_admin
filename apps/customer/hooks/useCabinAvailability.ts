import {
  cabinAvailabilityUrl,
  fetchCabinAvailability,
} from '@/lib/validations/cabin-availability-json';
import { useQuery } from '@tanstack/react-query';

export function useCabinAvailability(cabinId: string) {
  return useQuery({
    enabled: !!cabinId,
    gcTime: 1000 * 60 * 10,
    queryFn: async () =>
      (await fetchCabinAvailability(cabinAvailabilityUrl(cabinId))).data,
    queryKey: ['cabin-availability', cabinId],
    staleTime: 1000 * 60 * 5,
  });
}
