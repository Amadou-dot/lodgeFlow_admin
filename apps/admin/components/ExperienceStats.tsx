'use client';

import { useExperienceStats } from '@/hooks/useExperienceStats';
import OverviewInfoCard from './OverviewInfoCard';

export default function ExperienceStats() {
  const { data: stats, isLoading, error } = useExperienceStats();

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
        title='Total Experiences'
        description={stats.totalExperiences.toString()}
        variant='blue'
      />
      <OverviewInfoCard
        title='Popular'
        description={stats.popularCount.toString()}
        variant='purple'
      />
      <OverviewInfoCard
        title='Avg Price'
        description={`$${stats.averagePrice}`}
        variant='green'
      />
      <OverviewInfoCard
        title='Total Capacity'
        description={`${stats.totalCapacity} guests`}
        variant='orange'
      />
    </div>
  );
}
