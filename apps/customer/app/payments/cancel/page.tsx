'use client';

import { title, subtitle } from '@/components/primitives';
import { Button } from '@heroui/button';
import { Card, CardBody } from '@heroui/card';
import { XCircle, ArrowLeft, Calendar } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function PaymentCancelContent() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get('booking_id');

  return (
    <div className='flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4'>
      <Card className='max-w-lg w-full'>
        <CardBody className='flex flex-col items-center gap-6 p-8 text-center'>
          <XCircle className='w-20 h-20 text-warning' />
          <h1 className={title({ size: 'md' })}>Payment Cancelled</h1>
          <p className={subtitle()}>
            Your payment was not completed. Your booking is still active and you
            can pay at any time from your bookings page.
          </p>

          <div className='flex flex-col sm:flex-row gap-3 w-full mt-4'>
            {bookingId && (
              <Link
                className='flex-1'
                href={`/cabins/confirmation/${bookingId}`}
              >
                <Button
                  className='w-full'
                  color='primary'
                  startContent={<ArrowLeft className='w-4 h-4' />}
                >
                  Back to Booking
                </Button>
              </Link>
            )}
            <Link className='flex-1' href='/bookings'>
              <Button
                className='w-full'
                startContent={<Calendar className='w-4 h-4' />}
                variant='flat'
              >
                View My Bookings
              </Button>
            </Link>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

export default function PaymentCancelPage() {
  return (
    <Suspense
      fallback={
        <div className='flex items-center justify-center min-h-[60vh]'>
          <p>Loading...</p>
        </div>
      }
    >
      <PaymentCancelContent />
    </Suspense>
  );
}
