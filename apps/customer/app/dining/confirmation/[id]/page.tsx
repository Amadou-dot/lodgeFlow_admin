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

interface DiningReservationData {
  _id: string;
  dining: {
    _id: string;
    name: string;
    image: string;
    price: number;
    type: string;
    mealType: string;
    servingTime: { start: string; end: string };
    location?: string;
  };
  customer: string;
  date: string;
  time: string;
  numGuests: number;
  status: string;
  totalPrice: number;
  isPaid: boolean;
  dietaryRequirements: string[];
  specialRequests: string[];
  tablePreference: string;
  occasion?: string;
}

export default function DiningConfirmationPage({ params }: { params: Params }) {
  const [reservationId, setReservationId] = useState<string>('');
  const [reservation, setReservation] = useState<DiningReservationData | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, isLoaded } = useUser();

  useEffect(() => {
    const getId = async () => {
      const { id } = await params;
      setReservationId(id);
    };
    getId();
  }, [params]);

  useEffect(() => {
    const fetchReservation = async () => {
      if (!reservationId || !isLoaded) return;

      try {
        const response = await fetch(
          `/api/dining-reservations/${reservationId}`
        );
        const data = await response.json();

        if (!response.ok || !data.success) {
          setError(data.error || 'Reservation not found');
          setIsLoading(false);
          return;
        }

        setReservation(data.data);
        setIsLoading(false);
      } catch {
        setError('Failed to load reservation');
        setIsLoading(false);
      }
    };

    fetchReservation();
  }, [reservationId, isLoaded]);

  if (isLoading || !isLoaded) {
    return (
      <div className='flex flex-col justify-center items-center min-h-screen gap-4'>
        <Spinner label='Loading reservation details...' size='lg' />
      </div>
    );
  }

  if (user && reservation && reservation.customer !== user.id) {
    return (
      <div className='flex flex-col justify-center items-center min-h-screen gap-6 px-4'>
        <Card className='max-w-md w-full p-6'>
          <CardBody className='flex flex-col items-center gap-4 text-center'>
            <XCircle className='w-16 h-16 text-danger' />
            <h2 className={title({ size: 'sm' })}>Unauthorized Access</h2>
            <p className='text-default-600'>
              You don't have permission to view this reservation.
            </p>
            <Link className='w-full' href='/dining'>
              <Button className='w-full' color='primary' variant='flat'>
                Back to Dining
              </Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (error || !reservation) {
    return (
      <div className='flex flex-col justify-center items-center min-h-screen gap-6 px-4'>
        <Card className='max-w-md w-full p-6'>
          <CardBody className='flex flex-col items-center gap-4 text-center'>
            <XCircle className='w-16 h-16 text-danger' />
            <h2 className={title({ size: 'sm' })}>Reservation Not Found</h2>
            <p className='text-default-600'>
              {error || 'The reservation does not exist or has been removed.'}
            </p>
            <Link className='w-full' href='/dining'>
              <Button className='w-full' color='primary' variant='flat'>
                Browse Dining
              </Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  const reservationDate = new Date(reservation.date);
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const tablePreferenceLabels: Record<string, string> = {
    indoor: 'Indoor',
    outdoor: 'Outdoor',
    bar: 'Bar',
    'no-preference': 'No Preference',
  };

  return (
    <div className='container mx-auto px-4 py-8 max-w-4xl'>
      {/* Success Header */}
      <div className='flex flex-col items-center gap-4 mb-8 text-center'>
        <CheckCircle className='w-20 h-20 text-success' />
        <h1 className={title({ size: 'lg' })}>Reservation Submitted!</h1>
        <p className={subtitle()}>
          Your dining reservation has been received. We'll confirm it shortly.
        </p>
        <Chip color='warning' size='lg' variant='flat'>
          Status:{' '}
          {reservation.status.charAt(0).toUpperCase() +
            reservation.status.slice(1)}
        </Chip>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6'>
        {/* Dining Image */}
        <div className='relative h-64 lg:h-full min-h-[300px] rounded-lg overflow-hidden'>
          <Image
            alt={reservation.dining.name}
            className='rounded-lg'
            fill
            src={reservation.dining.image}
            style={{ objectFit: 'cover' }}
          />
        </div>

        {/* Reservation Summary */}
        <Card>
          <CardHeader>
            <h2 className={title({ size: 'sm' })}>Reservation Summary</h2>
          </CardHeader>
          <CardBody className='space-y-4'>
            <div>
              <p className='text-sm text-default-500'>Reservation ID</p>
              <p className='font-mono text-sm'>{reservation._id}</p>
            </div>

            <Divider />

            <div>
              <p className='text-sm text-default-500'>Dining</p>
              <p className='font-semibold text-lg'>{reservation.dining.name}</p>
            </div>

            <div className='flex items-center gap-2'>
              <Calendar className='w-4 h-4 text-default-400' />
              <div>
                <p className='text-sm text-default-500'>Date</p>
                <p className='font-semibold'>{formatDate(reservationDate)}</p>
              </div>
            </div>

            <div className='flex items-center gap-2'>
              <Clock className='w-4 h-4 text-default-400' />
              <div>
                <p className='text-sm text-default-500'>Time</p>
                <p className='font-semibold'>{reservation.time}</p>
              </div>
            </div>

            <div className='flex items-center gap-2'>
              <Users className='w-4 h-4 text-default-400' />
              <div>
                <p className='text-sm text-default-500'>Guests</p>
                <p className='font-semibold'>{reservation.numGuests}</p>
              </div>
            </div>

            {reservation.tablePreference !== 'no-preference' && (
              <div>
                <p className='text-sm text-default-500'>Table Preference</p>
                <p className='font-semibold'>
                  {tablePreferenceLabels[reservation.tablePreference]}
                </p>
              </div>
            )}

            {reservation.occasion && (
              <div>
                <p className='text-sm text-default-500'>Occasion</p>
                <p className='font-semibold'>{reservation.occasion}</p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Additional Info */}
      {(reservation.dietaryRequirements.length > 0 ||
        reservation.specialRequests.length > 0) && (
        <Card className='mb-6'>
          <CardHeader>
            <h2 className={title({ size: 'sm' })}>Additional Information</h2>
          </CardHeader>
          <CardBody className='space-y-4'>
            {reservation.dietaryRequirements.length > 0 && (
              <div>
                <p className='text-sm text-default-500 mb-2'>
                  Dietary Requirements:
                </p>
                <ul className='list-disc list-inside space-y-1'>
                  {reservation.dietaryRequirements.map((req, index) => (
                    <li key={index} className='text-sm'>
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {reservation.specialRequests.length > 0 && (
              <div>
                <p className='text-sm text-default-500 mb-2'>
                  Special Requests:
                </p>
                <ul className='list-disc list-inside space-y-1'>
                  {reservation.specialRequests.map((req, index) => (
                    <li key={index} className='text-sm'>
                      {req}
                    </li>
                  ))}
                </ul>
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
              ${reservation.dining.price} x {reservation.numGuests} guest
              {reservation.numGuests > 1 ? 's' : ''}
            </span>
            <span className='font-semibold'>${reservation.totalPrice}</span>
          </div>
          <Divider />
          <div className='flex justify-between items-center text-lg'>
            <span className='font-bold'>Total</span>
            <span className='font-bold text-success'>
              ${reservation.totalPrice}
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
