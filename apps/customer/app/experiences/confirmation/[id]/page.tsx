'use client';

import { useEffect, useState } from 'react';
import { Button } from '@heroui/button';
import { Card, CardBody, CardHeader } from '@heroui/card';
import { Chip } from '@heroui/chip';
import { Divider } from '@heroui/divider';
import { Spinner } from '@heroui/spinner';
import { useUser } from '@clerk/nextjs';
import {
  Calendar,
  CheckCircle,
  Clock,
  Home,
  Users,
  XCircle,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { title, subtitle } from '@/components/primitives';

type Params = Promise<{ id: string }>;

interface ExperienceBookingData {
  _id: string;
  experience: {
    _id: string;
    name: string;
    image: string;
    price: number;
    duration: string;
    category: string;
    location?: string;
  };
  customer: string;
  date: string;
  timeSlot?: string;
  numParticipants: number;
  status: string;
  totalPrice: number;
  isPaid: boolean;
  specialRequests: string[];
  observations?: string;
}

export default function ExperienceConfirmationPage({
  params,
}: {
  params: Params;
}) {
  const [bookingId, setBookingId] = useState<string>('');
  const [booking, setBooking] = useState<ExperienceBookingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, isLoaded } = useUser();

  useEffect(() => {
    const getId = async () => {
      const { id } = await params;
      setBookingId(id);
    };
    getId();
  }, [params]);

  useEffect(() => {
    const fetchBooking = async () => {
      if (!bookingId || !isLoaded) return;

      try {
        const response = await fetch(`/api/experience-bookings/${bookingId}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
          setError(data.error || 'Booking not found');
          setIsLoading(false);
          return;
        }

        setBooking(data.data);
        setIsLoading(false);
      } catch {
        setError('Failed to load booking');
        setIsLoading(false);
      }
    };

    fetchBooking();
  }, [bookingId, isLoaded]);

  if (isLoading || !isLoaded) {
    return (
      <div className='flex flex-col justify-center items-center min-h-screen gap-4'>
        <Spinner label='Loading booking details...' size='lg' />
      </div>
    );
  }

  if (user && booking && booking.customer !== user.id) {
    return (
      <div className='flex flex-col justify-center items-center min-h-screen gap-6 px-4'>
        <Card className='max-w-md w-full p-6'>
          <CardBody className='flex flex-col items-center gap-4 text-center'>
            <XCircle className='w-16 h-16 text-danger' />
            <h2 className={title({ size: 'sm' })}>Unauthorized Access</h2>
            <p className='text-default-600'>
              You don't have permission to view this booking.
            </p>
            <Link className='w-full' href='/experiences'>
              <Button className='w-full' color='primary' variant='flat'>
                Back to Experiences
              </Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className='flex flex-col justify-center items-center min-h-screen gap-6 px-4'>
        <Card className='max-w-md w-full p-6'>
          <CardBody className='flex flex-col items-center gap-4 text-center'>
            <XCircle className='w-16 h-16 text-danger' />
            <h2 className={title({ size: 'sm' })}>Booking Not Found</h2>
            <p className='text-default-600'>
              {error || 'The booking does not exist or has been removed.'}
            </p>
            <Link className='w-full' href='/experiences'>
              <Button className='w-full' color='primary' variant='flat'>
                Browse Experiences
              </Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  const bookingDate = new Date(booking.date);
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className='container mx-auto px-4 py-8 max-w-4xl'>
      {/* Success Header */}
      <div className='flex flex-col items-center gap-4 mb-8 text-center'>
        <CheckCircle className='w-20 h-20 text-success' />
        <h1 className={title({ size: 'lg' })}>Booking Submitted!</h1>
        <p className={subtitle()}>
          Your experience booking has been received. We'll confirm it shortly.
        </p>
        <Chip color='warning' size='lg' variant='flat'>
          Status:{' '}
          {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
        </Chip>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6'>
        {/* Experience Image */}
        <div className='relative h-64 lg:h-full min-h-[300px] rounded-lg overflow-hidden'>
          <Image
            alt={booking.experience.name}
            className='rounded-lg'
            fill
            src={booking.experience.image}
            style={{ objectFit: 'cover' }}
          />
        </div>

        {/* Booking Summary */}
        <Card>
          <CardHeader>
            <h2 className={title({ size: 'sm' })}>Booking Summary</h2>
          </CardHeader>
          <CardBody className='space-y-4'>
            <div>
              <p className='text-sm text-default-500'>Booking ID</p>
              <p className='font-mono text-sm'>{booking._id}</p>
            </div>

            <Divider />

            <div>
              <p className='text-sm text-default-500'>Experience</p>
              <p className='font-semibold text-lg'>{booking.experience.name}</p>
            </div>

            <div className='flex items-center gap-2'>
              <Calendar className='w-4 h-4 text-default-400' />
              <div>
                <p className='text-sm text-default-500'>Date</p>
                <p className='font-semibold'>{formatDate(bookingDate)}</p>
              </div>
            </div>

            {booking.timeSlot && (
              <div className='flex items-center gap-2'>
                <Clock className='w-4 h-4 text-default-400' />
                <div>
                  <p className='text-sm text-default-500'>Time</p>
                  <p className='font-semibold'>{booking.timeSlot}</p>
                </div>
              </div>
            )}

            <div className='flex items-center gap-2'>
              <Users className='w-4 h-4 text-default-400' />
              <div>
                <p className='text-sm text-default-500'>Participants</p>
                <p className='font-semibold'>{booking.numParticipants}</p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Special Requests */}
      {(booking.specialRequests.length > 0 || booking.observations) && (
        <Card className='mb-6'>
          <CardHeader>
            <h2 className={title({ size: 'sm' })}>Additional Information</h2>
          </CardHeader>
          <CardBody className='space-y-4'>
            {booking.specialRequests.length > 0 && (
              <div>
                <p className='text-sm text-default-500 mb-2'>
                  Special Requests:
                </p>
                <ul className='list-disc list-inside space-y-1'>
                  {booking.specialRequests.map((request, index) => (
                    <li key={index} className='text-sm'>
                      {request}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {booking.observations && (
              <div>
                <p className='text-sm text-default-500 mb-1'>Notes:</p>
                <p className='text-sm'>{booking.observations}</p>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Price Breakdown */}
      <Card className='mb-6'>
        <CardHeader>
          <h2 className={title({ size: 'sm' })}>Price Breakdown</h2>
        </CardHeader>
        <CardBody className='space-y-3'>
          <div className='flex justify-between items-center'>
            <span className='text-default-600'>
              ${booking.experience.price} x {booking.numParticipants}{' '}
              participant
              {booking.numParticipants > 1 ? 's' : ''}
            </span>
            <span className='font-semibold'>${booking.totalPrice}</span>
          </div>
          <Divider />
          <div className='flex justify-between items-center text-lg'>
            <span className='font-bold'>Total</span>
            <span className='font-bold text-success'>
              ${booking.totalPrice}
            </span>
          </div>
        </CardBody>
      </Card>

      {/* Action Buttons */}
      <div className='flex flex-col sm:flex-row gap-4 justify-center'>
        <Link href='/bookings'>
          <Button
            color='primary'
            size='lg'
            startContent={<Home className='w-4 h-4' />}
            variant='flat'
          >
            View My Bookings
          </Button>
        </Link>
      </div>
    </div>
  );
}
