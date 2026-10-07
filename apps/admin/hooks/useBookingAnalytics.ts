import type { ApiResponse } from '@/lib/api-utils';
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
      const result: ApiResponse<BookingAnalyticsData> | BookingAnalyticsData =
        await response.json();
      if ('success' in result) {
        if (!result.success)
          throw new Error(result.error || 'Failed to fetch booking analytics');
        return result.data;
      }
      return result;
    },
  });
}
