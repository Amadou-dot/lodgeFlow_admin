import {
  bookingAnalyticsJsonSchema,
  parseReportJson,
} from '@/lib/validations/reporting-json';
import { useQuery } from '@tanstack/react-query';

import type { AnalyticsPeriod, BookingAnalyticsData } from '@/types/reporting';
export type { AnalyticsPeriod, BookingAnalyticsData } from '@/types/reporting';

export function useBookingAnalytics(period: AnalyticsPeriod = '30d') {
  return useQuery<BookingAnalyticsData>({
    queryKey: ['booking-analytics', period],
    queryFn: async () => {
      const response = await fetch(`/api/bookings/analytics?period=${period}`);
      if (!response.ok) {
        throw new Error('Failed to fetch booking analytics');
      }
      const value: unknown = await response.json();
      return parseReportJson({
        value,
        schema: bookingAnalyticsJsonSchema,
        format: 'wrapped-or-bare',
        errorMessage: 'Failed to fetch booking analytics',
        useWrappedError: true,
      });
    },
  });
}
