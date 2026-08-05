'use client';

import { title, subtitle } from '@/components/primitives';
import { Button } from '@heroui/button';
import { Card, CardBody } from '@heroui/card';
import { CheckCircle, Calendar, Home } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get('booking_id');

  return (
    <div className='flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4'>
      <Card className='max-w-lg w-full'>
        <CardBody className='flex flex-col items-center gap-6 p-8 text-center'>
          <CheckCircle className='w-20 h-20 text-success' />
          <h1 className={title({ size: 'md' })}>Payment Successful!</h1>
          <p className={subtitle()}>
            Your payment has been processed successfully. You will receive a
            confirmation email shortly.
          </p>

          {bookingId && (
            <p className='text-sm text-default-500'>
              Booking ID: <span className='font-mono'>{bookingId}</span>
            </p>
          )}

          <div className='flex flex-col sm:flex-row gap-3 w-full mt-4'>
            <Link className='flex-1' href='/bookings'>
              <Button
                className='w-full'
                color='primary'
                startContent={<Calendar className='w-4 h-4' />}
              >
                View My Bookings
              </Button>
            </Link>
            <Link className='flex-1' href='/cabins'>
              <Button
                className='w-full'
                startContent={<Home className='w-4 h-4' />}
                variant='flat'
              >
                Browse Cabins
              </Button>
            </Link>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className='flex items-center justify-center min-h-[60vh]'>
          <p>Loading...</p>
        </div>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}
