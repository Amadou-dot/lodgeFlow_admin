import { useQuery } from '@tanstack/react-query';

export type AnalyticsPeriod = '7d' | '30d' | '90d' | '1y' | 'all';

interface ExtrasStat {
  count: number;
  rate: number;
}

export interface BookingAnalyticsData {
  summary: {
    totalRevenue: number;
    totalBookings: number;
    avgBookingValue: number;
    cancellationRate: number;
  };
  revenueOverTime: {
    date: string;
    revenue: number;
    bookings: number;
  }[];
  statusDistribution: {
    status: string;
    count: number;
  }[];
  popularCabins: {
    name: string;
    bookingCount: number;
    revenue: number;
  }[];
  demographics: {
    avgPartySize: number;
    avgStayLength: number;
    extras: {
      breakfast: ExtrasStat;
      pets: ExtrasStat;
      parking: ExtrasStat;
      earlyCheckIn: ExtrasStat;
      lateCheckOut: ExtrasStat;
    };
  };
}

export function useBookingAnalytics(period: AnalyticsPeriod = '30d') {
  return useQuery<BookingAnalyticsData>({
    queryKey: ['booking-analytics', period],
    queryFn: async () => {
      const response = await fetch(`/api/bookings/analytics?period=${period}`);
      if (!response.ok) {
        throw new Error('Failed to fetch booking analytics');
      }
      const result = await response.json();
      return result.success ? result.data : result;
    },
  });
}
