import { ReactNode } from 'react';
import { Card, CardBody, CardHeader } from '@heroui/card';

interface FeatureCardProps {
  title: string;
  description: string;
  icon?: ReactNode;
  image?: string;
  imagePlaceholder?: string;
}

interface FeatureGridProps {
  features: FeatureCardProps[];
  columns?: 2 | 3 | 4;
  className?: string;
}

export function FeatureGrid({
  features,
  columns = 3,
  className = '',
}: FeatureGridProps) {
  const gridCols = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={`grid ${gridCols[columns]} gap-6 ${className}`}>
      {features.map((feature, index) => (
        <FeatureCard key={index} {...feature} />
      ))}
    </div>
  );
}

function FeatureCard({
  title,
  description,
  icon,
  image,
  imagePlaceholder,
}: FeatureCardProps) {
  return (
    <Card className='py-4'>
      <CardHeader className='pb-0 pt-2 px-4 flex-col items-start'>
        {icon && <div className='text-2xl mb-2'>{icon}</div>}
        <h4 className='font-bold text-large'>{title}</h4>
      </CardHeader>
      <CardBody className='overflow-visible py-2'>
        {(image || imagePlaceholder) && (
          <div className='relative mb-4'>
            <div className='w-full h-48 bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900 dark:to-green-800 rounded-lg flex items-center justify-center'>
              {image ? (
                <img
                  alt={title}
                  className='w-full h-full object-cover rounded-lg'
                  src={image}
                />
              ) : (
                <span className='text-green-600 dark:text-green-300 text-sm'>
                  {imagePlaceholder || `${title} Image`}
                </span>
              )}
            </div>
          </div>
        )}
        <p className='text-default-500'>{description}</p>
      </CardBody>
    </Card>
  );
}
