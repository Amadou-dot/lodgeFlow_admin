import { useQuery } from '@tanstack/react-query';

// Overview/Stats hook - now uses MongoDB dashboard API
export function useOverview() {
  return useQuery({
    queryKey: ['overview'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard');
      if (!response.ok) {
        throw new Error('Failed to fetch overview data');
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch overview data');
      }

      // Transform the data to match the expected format
      const { overview } = result.data;

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
      const response = await fetch('/api/dashboard');
      if (!response.ok) {
        throw new Error('Failed to fetch activities');
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch activities data');
      }

      // Transform recent activity data
      const { recentActivity } = result.data;
      return recentActivity
        .slice(0, 4)
        .map(
          (booking: {
            id: string;
            customerName: string;
            status: string;
            checkInDate: string;
            checkOutDate: string;
          }) => {
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
          }
        );
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
      const data = await response.json();

      // Data is already in the correct format from the sales API
      return data;
    },
  });
}

// Duration distribution hook - uses pre-computed data from dashboard API
export function useDurationData() {
  return useQuery({
    queryKey: ['durations'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard');
      if (!response.ok) {
        throw new Error('Failed to fetch duration data');
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch duration data');
      }

      // Return pre-computed duration data from dashboard API
      return result.data.charts.durations || [];
    },
  });
}
