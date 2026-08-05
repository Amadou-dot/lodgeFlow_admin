'use client';

import { useDiningStats } from '@/hooks/useDiningStats';
import OverviewInfoCard from './OverviewInfoCard';

export default function DiningStats() {
  const { data: stats, isLoading, error } = useDiningStats();

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
        title='Total Items'
        description={stats.totalItems.toString()}
        variant='blue'
      />
      <OverviewInfoCard
        title='Menu / Experiences'
        description={`${stats.menuCount} / ${stats.experienceCount}`}
        variant='purple'
      />
      <OverviewInfoCard
        title='Avg Price'
        description={`$${stats.averagePrice}`}
        variant='green'
      />
      <OverviewInfoCard
        title='Available'
        description={stats.availableItems.toString()}
        variant='orange'
      />
    </div>
  );
}
