import {
  cabinStatsJsonSchema,
  parseReportJson,
} from '@/lib/validations/reporting-json';
import { useQuery } from '@tanstack/react-query';

import type { CabinStats } from '@/types/catalog-stats';

export function useCabinStats() {
  return useQuery<CabinStats>({
    queryKey: ['cabin-stats'],
    queryFn: async () => {
      const response = await fetch('/api/cabins/stats');
      const errorMessage = 'Failed to fetch cabin stats';
      if (!response.ok) throw new Error(errorMessage);
      const value: unknown = await response.json();
      return parseReportJson({
        value,
        schema: cabinStatsJsonSchema,
        format: 'wrapped-or-bare',
        errorMessage,
      });
    },
  });
}
