'use client';

import OverviewInfoCard from './OverviewInfoCard';

interface Props {
  summary?: {
    totalRevenue: number;
    totalBookings: number;
    avgBookingValue: number;
    cancellationRate: number;
  };
  isLoading: boolean;
}

export default function BookingAnalyticsStats({ summary, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className='grid grid-cols-2 lg:grid-cols-4 gap-4 w-full'>
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className='bg-content1 p-4 rounded-lg border border-divider animate-pulse'
          >
            <div className='h-4 bg-default-200 rounded mb-2'></div>
            <div className='h-6 bg-default-200 rounded'></div>
          </div>
        ))}
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className='grid grid-cols-2 lg:grid-cols-4 gap-4 w-full'>
      <OverviewInfoCard
        title='Total Revenue'
        description={`$${summary.totalRevenue.toLocaleString()}`}
        variant='blue'
      />
      <OverviewInfoCard
        title='Total Bookings'
        description={summary.totalBookings.toString()}
        variant='green'
      />
      <OverviewInfoCard
        title='Avg Booking Value'
        description={`$${summary.avgBookingValue.toLocaleString()}`}
        variant='purple'
      />
      <OverviewInfoCard
        title='Cancellation Rate'
        description={`${summary.cancellationRate}%`}
        variant='orange'
      />
    </div>
  );
}
