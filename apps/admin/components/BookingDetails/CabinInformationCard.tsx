import type { Cabin } from '@/types';
import { Card, CardBody, CardHeader } from '@heroui/card';

interface CabinInformationCardProps {
  cabin: Cabin;
  cabinPrice: number;
}

export default function CabinInformationCard({
  cabin,
  cabinPrice,
}: CabinInformationCardProps) {
  return (
    <Card>
      <CardHeader>
        <h2 className='text-lg font-semibold'>Cabin Information</h2>
      </CardHeader>
      <CardBody className='space-y-4'>
        <div className='flex items-center gap-4'>
          <div className='w-16 h-16 rounded-lg bg-default-100 flex items-center justify-center'>
            {cabin.image ? (
              <img
                src={cabin.image}
                alt={cabin.name}
                className='w-full h-full object-cover rounded-lg'
              />
            ) : (
              <span className='text-2xl'>🏡</span>
            )}
          </div>
          <div>
            <h3 className='font-semibold'>{cabin.name}</h3>
            <p className='text-sm text-default-500'>
              Capacity: {cabin.capacity} guests
            </p>
            <p className='text-sm text-default-500'>${cabinPrice} per night</p>
          </div>
        </div>
        {cabin.description && (
          <p className='text-sm text-default-600'>{cabin.description}</p>
        )}
      </CardBody>
    </Card>
  );
}
