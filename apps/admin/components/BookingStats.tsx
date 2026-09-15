'use client';

import { useBookingStats } from '@/hooks/useBookingStats';
import OverviewInfoCard from './OverviewInfoCard';

export default function BookingStats() {
  const { data: stats, isLoading, error } = useBookingStats();

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

  if (error || !stats) return null;

  return (
    <div className='grid grid-cols-2 lg:grid-cols-4 gap-4 w-full'>
      <OverviewInfoCard
        title="Today's Check-ins"
        description={stats.todayCheckIns.toString()}
        variant='blue'
      />
      <OverviewInfoCard
        title="Today's Check-outs"
        description={stats.todayCheckOuts.toString()}
        variant='purple'
      />
      <OverviewInfoCard
        title='Checked In'
        description={stats.checkedIn.toString()}
        variant='green'
      />
      <OverviewInfoCard
        title='Unconfirmed'
        description={stats.unconfirmed.toString()}
        variant='orange'
      />
    </div>
  );
}
