import {
  dashboardJsonSchema,
  parseReportJson,
  salesJsonSchema,
} from '@/lib/validations/reporting-json';
import { useQuery } from '@tanstack/react-query';

async function fetchDashboard({
  httpError,
  responseError = httpError,
}: {
  httpError: string;
  responseError?: string;
}) {
  const response = await fetch('/api/dashboard');
  if (!response.ok) throw new Error(httpError);
  const value: unknown = await response.json();

  return parseReportJson({
    value,
    schema: dashboardJsonSchema,
    format: 'wrapped',
    errorMessage: responseError,
    useWrappedError: true,
  });
}

// Overview/Stats hook - now uses MongoDB dashboard API
export function useOverview() {
  return useQuery({
    queryKey: ['overview'],
    queryFn: async () => {
      const { overview } = await fetchDashboard({
        httpError: 'Failed to fetch overview data',
      });

      return {
        bookings: overview.totalBookings,
        revenue: overview.totalRevenue,
        customers: overview.totalCustomers,
        cancellations: overview.totalCancellations || 0,
      };
    },
  });
}

// Activities hook - uses recent bookings from dashboard API
export function useActivities() {
  return useQuery({
    queryKey: ['activities'],
    queryFn: async () => {
      const { recentActivity } = await fetchDashboard({
        httpError: 'Failed to fetch activities',
        responseError: 'Failed to fetch activities data',
      });
      return recentActivity.slice(0, 4).map(booking => {
        const checkIn = new Date(booking.checkInDate);
        const checkOut = new Date(booking.checkOutDate);
        const nights = Math.ceil(
          (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
        );

        return {
          id: booking.id,
          name: booking.customerName,
          status: booking.status,
          stayDuration: `${nights} night${nights === 1 ? '' : 's'}`,
        };
      });
    },
  });
}

// Sales data hook - uses the dedicated sales API endpoint
export function useSalesData() {
  return useQuery({
    queryKey: ['sales'],
    queryFn: async () => {
      const response = await fetch('/api/sales');
      if (!response.ok) {
        throw new Error('Failed to fetch sales data');
      }
      const value: unknown = await response.json();
      return parseReportJson({
        value,
        schema: salesJsonSchema,
        format: 'bare',
        errorMessage: 'Failed to fetch sales data',
      });
    },
  });
}

// Duration distribution hook - uses pre-computed data from dashboard API
export function useDurationData() {
  return useQuery({
    queryKey: ['durations'],
    queryFn: async () => {
      const { charts } = await fetchDashboard({
        httpError: 'Failed to fetch duration data',
      });

      // Return pre-computed duration data from dashboard API
      return charts.durations || [];
    },
  });
}
