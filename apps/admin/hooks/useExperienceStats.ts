import {
  experienceStatsJsonSchema,
  parseReportJson,
} from '@/lib/validations/reporting-json';
import { useQuery } from '@tanstack/react-query';

import type { ExperienceStats } from '@/types/catalog-stats';

export function useExperienceStats() {
  return useQuery<ExperienceStats>({
    queryKey: ['experience-stats'],
    queryFn: async () => {
      const response = await fetch('/api/experiences/stats');
      const errorMessage = 'Failed to fetch experience stats';
      if (!response.ok) throw new Error(errorMessage);
      const value: unknown = await response.json();
      return parseReportJson({
        value,
        schema: experienceStatsJsonSchema,
        format: 'wrapped-or-bare',
        errorMessage,
      });
    },
  });
}
