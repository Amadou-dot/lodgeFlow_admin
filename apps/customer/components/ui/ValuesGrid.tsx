import { ReactNode } from 'react';
import { Card, CardBody } from '@heroui/card';

interface ValueCardProps {
  title: string;
  description: string;
  icon: ReactNode;
}

interface ValuesGridProps {
  values: ValueCardProps[];
  columns?: 2 | 3 | 4;
  className?: string;
}

export function ValuesGrid({
  values,
  columns = 2,
  className = '',
}: ValuesGridProps) {
  const gridCols = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={`grid ${gridCols[columns]} gap-6 ${className}`}>
      {values.map((value, index) => (
        <ValueCard key={index} {...value} />
      ))}
    </div>
  );
}

function ValueCard({ title, description, icon }: ValueCardProps) {
  return (
    <Card className='py-6'>
      <CardBody className='text-center space-y-4'>
        <div className='text-4xl'>{icon}</div>
        <h3 className='text-xl font-bold'>{title}</h3>
        <p className='text-default-600'>{description}</p>
      </CardBody>
    </Card>
  );
}
