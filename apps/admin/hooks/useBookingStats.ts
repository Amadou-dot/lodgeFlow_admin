import { useQuery } from '@tanstack/react-query';

interface BookingStats {
  todayCheckIns: number;
  todayCheckOuts: number;
  checkedIn: number;
  unconfirmed: number;
}

export function useBookingStats() {
  return useQuery<BookingStats>({
    queryKey: ['booking-stats'],
    queryFn: async () => {
      const response = await fetch('/api/bookings/stats');
      if (!response.ok) {
        throw new Error('Failed to fetch booking stats');
      }
      const result = await response.json();
      return result.success ? result.data : result;
    },
  });
}
