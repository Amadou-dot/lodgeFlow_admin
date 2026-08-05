import { ReactNode } from 'react';

interface StatCardProps {
  value: string | number;
  label: string;
  icon?: ReactNode;
  color?: 'default' | 'green' | 'blue' | 'purple' | 'orange';
}

interface StatsGridProps {
  stats: StatCardProps[];
  columns?: 2 | 3 | 4;
  className?: string;
}

export function StatsGrid({
  stats,
  columns = 4,
  className = '',
}: StatsGridProps) {
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={`grid ${gridCols[columns]} gap-6 text-center ${className}`}>
      {stats.map((stat, index) => (
        <StatCard key={index} {...stat} />
      ))}
    </div>
  );
}

function StatCard({ value, label, icon, color = 'green' }: StatCardProps) {
  const colorClasses = {
    default: 'text-default-600',
    green: 'text-green-600',
    blue: 'text-blue-600',
    purple: 'text-purple-600',
    orange: 'text-orange-600',
  };

  return (
    <div className='space-y-2'>
      {icon && <div className='text-2xl'>{icon}</div>}
      <div className={`text-3xl lg:text-4xl font-bold ${colorClasses[color]}`}>
        {value}
      </div>
      <div className='text-sm text-default-600'>{label}</div>
    </div>
  );
}
