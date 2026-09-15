'use client';

import { useEffect, useState } from 'react';
import { Button } from '@heroui/button';
import { Card, CardBody } from '@heroui/card';
import { Chip } from '@heroui/chip';
import { Spinner } from '@heroui/spinner';
import { ArrowLeft, Clock, MapPin, Users } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import ExperienceBookingForm from '@/components/ExperienceBookingForm';
import { title } from '@/components/primitives';
import { useExperience } from '@/hooks/useExperience';

type Params = Promise<{ id: string }>;

export default function ExperienceBookPage({ params }: { params: Params }) {
  const [experienceId, setExperienceId] = useState<string>('');
  const { data: experience, isLoading, error } = useExperience(experienceId);

  useEffect(() => {
    const getId = async () => {
      const { id } = await params;
      setExperienceId(id);
    };
    getId();
  }, [params]);

  if (isLoading || !experienceId) {
    return (
      <div className='flex flex-col justify-center items-center min-h-screen gap-4'>
        <Spinner label='Loading experience...' size='lg' />
      </div>
    );
  }

  if (error || !experience) {
    return (
      <div className='flex flex-col justify-center items-center min-h-screen gap-4'>
        <p className='text-danger'>Experience not found</p>
        <Link href='/experiences'>
          <Button
            startContent={<ArrowLeft className='w-4 h-4' />}
            variant='flat'
          >
            Back to Experiences
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className='max-w-7xl mx-auto px-4 py-8'>
      {/* Back Button */}
      <Link href={`/experiences/${experienceId}`}>
        <Button
          className='mb-6'
          startContent={<ArrowLeft className='w-4 h-4' />}
          variant='light'
        >
          Back to Experience
        </Button>
      </Link>

      <h1 className={title({ size: 'md' })}>Book: {experience.name}</h1>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8'>
        {/* Experience Summary */}
        <div className='space-y-6'>
          <div className='relative h-64 rounded-xl overflow-hidden'>
            <Image
              alt={experience.name}
              className='object-cover'
              fill
              src={experience.image}
            />
          </div>

          <Card>
            <CardBody className='space-y-4'>
              <h3 className='text-lg font-semibold'>{experience.name}</h3>
              <p className='text-sm text-default-600'>
                {experience.description}
              </p>

              <div className='flex flex-wrap gap-3'>
                <Chip
                  size='sm'
                  startContent={<Clock className='w-3 h-3' />}
                  variant='flat'
                >
                  {experience.duration}
                </Chip>
                {experience.maxParticipants && (
                  <Chip
                    size='sm'
                    startContent={<Users className='w-3 h-3' />}
                    variant='flat'
                  >
                    Max {experience.maxParticipants}
                  </Chip>
                )}
                {experience.location && (
                  <Chip
                    size='sm'
                    startContent={<MapPin className='w-3 h-3' />}
                    variant='flat'
                  >
                    {experience.location}
                  </Chip>
                )}
              </div>

              {experience.includes.length > 0 && (
                <div>
                  <p className='text-sm font-medium mb-2'>What's Included:</p>
                  <ul className='text-sm text-default-600 space-y-1'>
                    {experience.includes.map((item, i) => (
                      <li key={i}>• {item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Booking Form */}
        <div>
          <ExperienceBookingForm experience={experience} />
        </div>
      </div>
    </div>
  );
}
