import { Experience } from '@/types';
import { ExperienceCard } from './ExperienceCard';

interface ExperienceGridProps {
  items: Experience[];
  columns?: 2 | 3 | 4;
  className?: string;
  onView?: (experience: Experience) => void;
  onEdit?: (experience: Experience) => void;
  onDelete?: (experience: Experience) => void;
}

export function ExperienceGrid({
  items,
  columns = 3,
  className = '',
  onView,
  onEdit,
  onDelete,
}: ExperienceGridProps) {
  const gridCols = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  };

  return (
    <div className={`grid ${gridCols[columns]} gap-6 ${className}`}>
      {items.map(item => (
        <ExperienceCard
          key={item._id}
          experience={item}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
