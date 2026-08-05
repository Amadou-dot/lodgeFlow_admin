'use client';

import CabinCard from '@/components/CabinCard';
import { useCabins } from '@/hooks/useCabins';
import { Skeleton } from '@heroui/skeleton';

// Maximum number of similar cabins to display
const SIMILAR_CABINS_LIMIT = 4;

interface CabinSimilarProps {
  capacity: number;
  currentCabinId: string;
}

function LoadingSkeleton() {
  return (
    <div className='flex gap-4 overflow-x-auto lg:grid lg:grid-cols-4 lg:overflow-visible'>
      {Array.from({ length: SIMILAR_CABINS_LIMIT }).map((_, i) => (
        <Skeleton
          key={i}
          className='h-[300px] w-64 shrink-0 rounded-2xl lg:w-full'
        />
      ))}
    </div>
  );
}

export default function CabinSimilar({
  capacity,
  currentCabinId,
}: CabinSimilarProps) {
  // The API filters for capacity >= (capacity - 1), so results are approximate
  // and may include a wider range than an exact ±1 capacity match.
  const {
    data: cabins,
    isError,
    isLoading,
  } = useCabins({
    capacity: Math.max(1, capacity - 1),
  });

  const similarCabins = (cabins ?? [])
    .filter(cabin => cabin._id.toString() !== currentCabinId)
    .slice(0, SIMILAR_CABINS_LIMIT);

  return (
    <div>
      <h2 className='mb-4 text-xl font-semibold'>Similar Cabins</h2>

      {isLoading ? (
        <LoadingSkeleton />
      ) : isError ? (
        <p className='text-sm text-danger'>Unable to load similar cabins.</p>
      ) : similarCabins.length === 0 ? (
        <p className='text-foreground-500 text-sm'>
          No similar cabins available at this time.
        </p>
      ) : (
        <div className='flex gap-4 overflow-x-auto lg:grid lg:grid-cols-4 lg:overflow-visible'>
          {similarCabins.map(cabin => (
            <div
              key={cabin._id.toString()}
              className='w-64 shrink-0 lg:w-full lg:h-full'
            >
              <CabinCard cabin={cabin} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
