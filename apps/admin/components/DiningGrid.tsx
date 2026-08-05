import { Dining } from '@/types';
import { DiningCard } from './DiningCard';

interface DiningGridProps {
  dining: Dining[];
  onView?: (dining: Dining) => void;
  onEdit?: (dining: Dining) => void;
  onDelete?: (dining: Dining) => void;
}

export const DiningGrid = ({
  dining,
  onView,
  onEdit,
  onDelete,
}: DiningGridProps) => {
  return (
    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-4 lg:gap-4'>
      {dining.map(item => (
        <DiningCard
          key={item._id}
          dining={item}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};
