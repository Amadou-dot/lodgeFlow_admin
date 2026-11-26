import {
  bookingStatsJsonSchema,
  parseReportJson,
} from '@/lib/validations/reporting-json';
import { useQuery } from '@tanstack/react-query';

import type { BookingStats } from '@/types/catalog-stats';

export function useBookingStats() {
  return useQuery<BookingStats>({
    queryKey: ['booking-stats'],
    queryFn: async () => {
      const response = await fetch('/api/bookings/stats');
      const errorMessage = 'Failed to fetch booking stats';
      if (!response.ok) throw new Error(errorMessage);
      const value: unknown = await response.json();
      return parseReportJson({
        value,
        schema: bookingStatsJsonSchema,
        format: 'wrapped-or-bare',
        errorMessage,
      });
    },
  });
}
