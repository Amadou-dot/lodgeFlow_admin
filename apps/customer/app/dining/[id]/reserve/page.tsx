'use client';

import { useEffect, useState } from 'react';
import { Button } from '@heroui/button';
import { Card, CardBody } from '@heroui/card';
import { Chip } from '@heroui/chip';
import { Spinner } from '@heroui/spinner';
import { ArrowLeft, Clock, MapPin, Users } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import DiningReservationForm from '@/components/DiningReservationForm';
import { title } from '@/components/primitives';
import { useDiningItem } from '@/hooks/useDiningItem';

type Params = Promise<{ id: string }>;

export default function DiningReservePage({ params }: { params: Params }) {
  const [diningId, setDiningId] = useState<string>('');
  const { data: dining, isLoading, error } = useDiningItem(diningId);

  useEffect(() => {
    const getId = async () => {
      const { id } = await params;
      setDiningId(id);
    };
    getId();
  }, [params]);

  if (isLoading || !diningId) {
    return (
      <div className='flex flex-col justify-center items-center min-h-screen gap-4'>
        <Spinner label='Loading dining details...' size='lg' />
      </div>
    );
  }

  if (error || !dining) {
    return (
      <div className='flex flex-col justify-center items-center min-h-screen gap-4'>
        <p className='text-danger'>Dining option not found</p>
        <Link href='/dining'>
          <Button
            startContent={<ArrowLeft className='w-4 h-4' />}
            variant='flat'
          >
            Back to Dining
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className='max-w-7xl mx-auto px-4 py-8'>
      {/* Back Button */}
      <Link href={`/dining/${diningId}`}>
        <Button
          className='mb-6'
          startContent={<ArrowLeft className='w-4 h-4' />}
          variant='light'
        >
          Back to Details
        </Button>
      </Link>

      <h1 className={title({ size: 'md' })}>Reserve: {dining.name}</h1>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8'>
        {/* Dining Summary */}
        <div className='space-y-6'>
          <div className='relative h-64 rounded-xl overflow-hidden'>
            <Image
              alt={dining.name}
              className='object-cover'
              fill
              src={dining.image}
            />
          </div>

          <Card>
            <CardBody className='space-y-4'>
              <h3 className='text-lg font-semibold'>{dining.name}</h3>
              <p className='text-sm text-default-600'>{dining.description}</p>

              <div className='flex flex-wrap gap-3'>
                <Chip
                  size='sm'
                  startContent={<Clock className='w-3 h-3' />}
                  variant='flat'
                >
                  {dining.servingTime.start} - {dining.servingTime.end}
                </Chip>
                <Chip
                  size='sm'
                  startContent={<Users className='w-3 h-3' />}
                  variant='flat'
                >
                  {dining.minPeople > 1 ? `${dining.minPeople}-` : '1-'}
                  {dining.maxPeople} guests
                </Chip>
                {dining.location && (
                  <Chip
                    size='sm'
                    startContent={<MapPin className='w-3 h-3' />}
                    variant='flat'
                  >
                    {dining.location}
                  </Chip>
                )}
              </div>

              {dining.includes && dining.includes.length > 0 && (
                <div>
                  <p className='text-sm font-medium mb-2'>Includes:</p>
                  <ul className='text-sm text-default-600 space-y-1'>
                    {dining.includes.map((item, i) => (
                      <li key={i}>• {item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {dining.dietary && dining.dietary.length > 0 && (
                <div>
                  <p className='text-sm font-medium mb-2'>Dietary Options:</p>
                  <div className='flex flex-wrap gap-2'>
                    {dining.dietary.map((diet, i) => (
                      <Chip key={i} color='success' size='sm' variant='flat'>
                        {diet}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Reservation Form */}
        <div>
          <DiningReservationForm dining={dining} />
        </div>
      </div>
    </div>
  );
}
