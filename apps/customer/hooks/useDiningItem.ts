import {
  readCatalogResponse,
  diningDetailSchema,
} from '@/lib/validations/catalog-json';
import { useQuery } from '@tanstack/react-query';

import type { Dining } from '@/types';

/**
 * Hook to fetch a single dining item by ID
 */
export const useDiningItem = (diningId: string) => {
  return useQuery({
    enabled: !!diningId,
    queryFn: async (): Promise<Dining> => {
      const response = await fetch(`/api/dining/${diningId}`);

      return readCatalogResponse({
        response,
        schema: diningDetailSchema(diningId),
        fallback: 'Failed to fetch dining item',
      });
    },
    queryKey: ['dining-item', diningId],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};
