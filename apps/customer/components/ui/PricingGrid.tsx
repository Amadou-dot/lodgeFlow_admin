import { ReactNode } from 'react';
import { Button } from '@heroui/button';
import { Card, CardBody, CardHeader } from '@heroui/card';
import { Chip } from '@heroui/chip';
import { Link } from '@heroui/link';
import Image from 'next/image';

interface PricingItem {
  name: string;
  price: number;
  originalPrice?: number;
  duration?: string;
  description: string;
  includes?: string[];
  difficulty?: string;
  category?: string;
  available?: string[];
  maxGuests?: number;
  ctaText?: string;
  ctaHref?: string;
  isPopular?: boolean;
  image?: string;
  gallery?: string[];
}

interface PricingGridProps {
  items: PricingItem[];
  columns?: 2 | 3 | 4;
  showCTA?: boolean;
  className?: string;
}

export function PricingGrid({
  items,
  columns = 3,
  showCTA = true,
  className = '',
}: PricingGridProps) {
  const gridCols = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={`grid ${gridCols[columns]} gap-6 ${className}`}>
      {items.map((item, index) => (
        <PricingCard key={index} item={item} showCTA={showCTA} />
      ))}
    </div>
  );
}

function PricingCard({
  item,
  showCTA,
}: {
  item: PricingItem;
  showCTA: boolean;
}) {
  const hasDiscount = item.originalPrice && item.originalPrice > item.price;

  return (
    <Card
      className={`py-4 ${item.isPopular ? 'ring-2 ring-primary' : ''}`}
      shadow={item.isPopular ? 'lg' : 'sm'}
    >
      {/* Image Section */}
      {item.image && (
        <div className='relative w-full h-48 mb-4'>
          <Image
            alt={item.name}
            className='rounded-t-lg'
            fill
            src={item.image}
            style={{ objectFit: 'cover' }}
          />
          {item.isPopular && (
            <div className='absolute top-2 right-2'>
              <Chip color='primary' size='sm' variant='solid'>
                Popular
              </Chip>
            </div>
          )}
        </div>
      )}

      <CardHeader className='pb-0 pt-2 px-4 flex-col items-start'>
        <div className='flex justify-between items-start w-full mb-2'>
          <h4 className='font-bold text-large'>{item.name}</h4>
          {item.isPopular && !item.image && (
            <Chip color='primary' size='sm' variant='flat'>
              Popular
            </Chip>
          )}
        </div>

        {/* Price Section */}
        <div className='flex items-center gap-2 mb-2'>
          {hasDiscount && (
            <span className='line-through text-default-400 text-sm'>
              ${item.originalPrice}
            </span>
          )}
          <span className='font-bold text-2xl text-green-600'>
            ${item.price}
          </span>
          {item.duration && (
            <span className='text-sm text-default-500'>/{item.duration}</span>
          )}
        </div>

        {/* Metadata Chips */}
        <div className='flex flex-wrap gap-2 mb-3'>
          {item.difficulty && (
            <Chip color='default' size='sm' variant='flat'>
              {item.difficulty}
            </Chip>
          )}
          {item.category && (
            <Chip color='secondary' size='sm' variant='flat'>
              {item.category}
            </Chip>
          )}
          {item.maxGuests && (
            <Chip color='primary' size='sm' variant='flat'>
              Max {item.maxGuests} guests
            </Chip>
          )}
        </div>
      </CardHeader>

      <CardBody className='overflow-visible py-2'>
        <p className='text-default-600 mb-4'>{item.description}</p>

        {/* Includes Section */}
        {item.includes && item.includes.length > 0 && (
          <div className='mb-4'>
            <h5 className='font-semibold mb-2 text-sm'>Includes:</h5>
            <ul className='text-sm text-default-600 space-y-1'>
              {item.includes.map((include, index) => (
                <li key={index} className='flex items-center gap-2'>
                  <span className='text-green-500'>✓</span>
                  {include}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Availability */}
        {item.available && item.available.length > 0 && (
          <div className='mb-4'>
            <h5 className='font-semibold mb-2 text-sm'>Availability:</h5>
            <div className='flex flex-wrap gap-1'>
              {item.available.map((avail, index) => (
                <Chip key={index} color='success' size='sm' variant='dot'>
                  {avail}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {/* CTA Button */}
        {showCTA && (
          <Button
            as={item.ctaHref ? Link : undefined}
            className='w-full mt-4'
            color='primary'
            href={item.ctaHref}
            variant={item.isPopular ? 'solid' : 'bordered'}
          >
            {item.ctaText || 'Book Now'}
          </Button>
        )}
      </CardBody>
    </Card>
  );
}
