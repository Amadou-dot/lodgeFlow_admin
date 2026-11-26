import {
  diningStatsJsonSchema,
  parseReportJson,
} from '@/lib/validations/reporting-json';
import { useQuery } from '@tanstack/react-query';

import type { DiningStats } from '@/types/catalog-stats';

export function useDiningStats() {
  return useQuery<DiningStats>({
    queryKey: ['dining-stats'],
    queryFn: async () => {
      const response = await fetch('/api/dining/stats');
      const errorMessage = 'Failed to fetch dining stats';
      if (!response.ok) throw new Error(errorMessage);
      const value: unknown = await response.json();
      return parseReportJson({
        value,
        schema: diningStatsJsonSchema,
        format: 'wrapped-or-bare',
        errorMessage,
      });
    },
  });
}
