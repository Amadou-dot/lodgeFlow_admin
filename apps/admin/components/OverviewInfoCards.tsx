'use client';

import OverviewInfoCard from './OverviewInfoCard';
import { useOverview } from '@/hooks/useData';

export default function OverviewInfoCards() {
  const { data: overview, isLoading, error } = useOverview();

  if (isLoading) {
    return (
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full'>
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

  if (error) {
    return (
      <div className='bg-danger-50 border border-danger-200 p-4 rounded-lg'>
        <p className='text-danger-600'>Failed to load overview data</p>
      </div>
    );
  }

  if (!overview) return null;

  return (
    <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full'>
      <OverviewInfoCard
        title='Bookings'
        description={overview.bookings.toString()}
        variant='blue'
      />
      <OverviewInfoCard
        title='Cancellations'
        description={overview.cancellations.toString()}
        variant='orange'
      />
      <OverviewInfoCard
        title='Revenue'
        description={`$${overview.revenue.toLocaleString()}`}
        variant='green'
      />
      <OverviewInfoCard
        title='Customers'
        description={overview.customers.toString()}
        variant='purple'
      />
    </div>
  );
}
