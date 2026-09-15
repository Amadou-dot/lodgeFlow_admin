import { Card, CardBody, CardFooter, CardHeader } from '@heroui/card';
import { Button } from '@heroui/button';
import { Chip } from '@heroui/chip';
import { Link } from '@heroui/link';
import Image from 'next/image';
import type { Cabin } from '@/types';

interface CabinCardProps {
  cabin: Cabin;
}

/** TODO: Replace with real popularity metric (e.g., booking count in last 30 days) */
function isPseudoPopular(cabinId: string): boolean {
  const value = parseInt(cabinId.slice(-4), 16);
  if (Number.isNaN(value)) return false;
  return value % 10 < 3;
}

export default function CabinCard({ cabin }: CabinCardProps) {
  const discountedPrice =
    cabin.discount > 0 ? cabin.price - cabin.discount : cabin.price;

  return (
    <Card className='w-full h-full'>
      <CardHeader className='pb-0 pt-2 px-4 flex-col items-start'>
        <div className='relative w-full h-48 mb-2'>
          <Image
            alt={cabin.name}
            className='object-cover rounded-lg'
            fill
            src={cabin.image}
          />
          {isPseudoPopular(cabin._id.toString()) && (
            <Chip
              className='absolute top-2 left-2'
              color='warning'
              size='sm'
              variant='solid'
            >
              Popular
            </Chip>
          )}
          {cabin.discount > 0 && (
            <Chip
              className='absolute top-2 right-2'
              color='danger'
              variant='solid'
            >
              ${cabin.discount} OFF
            </Chip>
          )}
        </div>
      </CardHeader>
      <CardBody className='overflow-visible py-2'>
        <div className='flex justify-between items-start mb-2'>
          <h4 className='font-bold text-large'>{cabin.name}</h4>
          <div className='flex items-center gap-1'>
            <span className='text-small text-default-500'>👥</span>
            <span className='text-small text-default-500'>
              {cabin.capacity}
            </span>
          </div>
        </div>

        <p className='text-default-500 text-small line-clamp-2 mb-3'>
          {cabin.description}
        </p>

        {(cabin.bedrooms ||
          cabin.bathrooms ||
          cabin.size ||
          cabin.minNights) && (
          <div className='flex flex-wrap items-center gap-2 mb-3'>
            {(cabin.bedrooms || cabin.bathrooms || cabin.size) && (
              <span className='text-small text-default-600'>
                {[
                  cabin.bedrooms ? `${cabin.bedrooms} bd` : null,
                  cabin.bathrooms ? `${cabin.bathrooms} ba` : null,
                  cabin.size ? `${cabin.size} ft²` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            )}
            {cabin.minNights && (
              <Chip size='sm' variant='flat'>
                Min {cabin.minNights} nights
              </Chip>
            )}
          </div>
        )}

        {cabin.amenities && cabin.amenities.length > 0 && (
          <div className='flex flex-wrap gap-1 mb-3'>
            {cabin.amenities.slice(0, 3).map((amenity, index) => (
              <Chip key={index} size='sm' variant='flat'>
                {amenity}
              </Chip>
            ))}
            {cabin.amenities.length > 3 && (
              <Chip color='default' size='sm' variant='flat'>
                +{cabin.amenities.length - 3} more
              </Chip>
            )}
          </div>
        )}

        <div className='flex items-center gap-2'>
          {cabin.discount > 0 && (
            <span className='text-small text-default-400 line-through'>
              ${cabin.price}/night
            </span>
          )}
          <span className='text-large font-bold text-success'>
            ${discountedPrice}/night
          </span>
        </div>
      </CardBody>
      <CardFooter className='pt-0'>
        <Button
          as={Link}
          className='w-full'
          color='primary'
          href={`/cabins/${cabin._id}`}
          variant='solid'
        >
          View Details & Book
        </Button>
      </CardFooter>
    </Card>
  );
}
