'use client';
import { subtitle, title } from '@/components/primitives';
import { useUser } from '@clerk/nextjs';
import { Button } from '@heroui/button';
import { Card, CardBody, CardHeader } from '@heroui/card';
import { Chip } from '@heroui/chip';
import { Divider } from '@heroui/divider';
import { Spinner } from '@heroui/spinner';
import { CheckCircle, Home, XCircle } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import {
  useConfirmationId,
  isUnavailableConfirmationError,
} from '@/hooks/useConfirmation';
import { useBookingById } from '@/hooks/useBooking';

import PaymentButton from '@/components/PaymentButton';
import { formatBookingStayDate } from '@/lib/booking-date';

type Params = Promise<{
  id: string;
}>;

export default function BookingConfirmationPage({
  params,
}: {
  params: Params;
}) {
  const { user, isLoaded } = useUser();
  const bookingId = useConfirmationId(params);
  const {
    data: booking,
    isPending: isLoading,
    error: queryError,
    refetch,
  } = useBookingById(bookingId, { enabled: isLoaded, mode: 'confirmation' });
  const error =
    !booking || isUnavailableConfirmationError(queryError)
      ? queryError?.message
      : undefined;

  if (isLoading || !isLoaded) {
    return (
      <div className='flex flex-col justify-center items-center min-h-screen gap-4'>
        <Spinner label='Loading booking details...' size='lg' />
      </div>
    );
  }

  // Check if user is authorized
  if (!error && (!user || (booking && booking.customer !== user.id))) {
    return (
      <div className='flex flex-col justify-center items-center min-h-screen gap-6 px-4'>
        <Card className='max-w-md w-full p-6'>
          <CardBody className='flex flex-col items-center gap-4 text-center'>
            <XCircle className='w-16 h-16 text-danger' />
            <h2 className={title({ size: 'sm' })}>Unauthorized Access</h2>
            <p className='text-default-600'>
              You don't have permission to view this booking confirmation. This
              booking belongs to another user.
            </p>
            <Divider className='my-2' />
            <Link className='w-full' href='/cabins'>
              <Button
                className='w-full'
                color='primary'
                startContent={<Home className='w-4 h-4' />}
                variant='flat'
              >
                Return to Cabins
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
              {error ||
                'The booking you are looking for does not exist or has been removed.'}
            </p>
            <Divider className='my-2' />
            <Button
              color='primary'
              variant='flat'
              onPress={() => {
                void refetch();
              }}
            >
              Try Again
            </Button>
            <Link className='w-full' href='/cabins'>
              <Button
                className='w-full'
                color='primary'
                startContent={<Home className='w-4 h-4' />}
                variant='flat'
              >
                Return to Cabins
              </Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  const cabinName = booking.cabin?.name ?? 'Removed cabin';
  const extras = booking.extras;
  const specialRequests = booking.specialRequests ?? [];
  const extrasPrice = booking.extrasPrice ?? 0;
  const depositAmount = booking.depositAmount ?? 0;

  return (
    <div className='container mx-auto px-4 py-8 max-w-4xl'>
      {/* Success Header */}
      <div className='flex flex-col items-center gap-4 mb-8 text-center'>
        <CheckCircle className='w-20 h-20 text-success' />
        <h1 className={title({ size: 'lg' })}>Booking Request Submitted!</h1>
        <p className={subtitle()}>
          Your booking request has been received. We'll review it and send you a
          confirmation email shortly.
        </p>
        <Chip color='warning' size='lg' variant='flat'>
          Status:{' '}
          {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
        </Chip>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6'>
        {/* Cabin Image */}
        <div className='relative h-64 lg:h-full min-h-75 rounded-lg overflow-hidden'>
          <Image
            alt={cabinName}
            className='rounded-lg'
            fill
            style={{ objectFit: 'cover' }}
            src={
              booking.cabin?.image ||
              'https://images.unsplash.com/photo-1571896349842-33c89424de2d'
            }
          />
        </div>

        {/* Booking Summary Card */}
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
              <p className='text-sm text-default-500'>Cabin</p>
              <p className='font-semibold text-lg'>{cabinName}</p>
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div>
                <p className='text-sm text-default-500'>Check-in</p>
                <p className='font-semibold'>
                  {formatBookingStayDate({
                    date: booking.checkInDate,
                    weekday: 'long',
                  })}
                </p>
              </div>
              <div>
                <p className='text-sm text-default-500'>Check-out</p>
                <p className='font-semibold'>
                  {formatBookingStayDate({
                    date: booking.checkOutDate,
                    weekday: 'long',
                  })}
                </p>
              </div>
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div>
                <p className='text-sm text-default-500'>Nights</p>
                <p className='font-semibold'>{booking.numNights}</p>
              </div>
              <div>
                <p className='text-sm text-default-500'>Guests</p>
                <p className='font-semibold'>{booking.numGuests}</p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Extras & Special Requests */}
      {(extras?.hasBreakfast ||
        extras?.hasPets ||
        extras?.hasParking ||
        extras?.hasEarlyCheckIn ||
        extras?.hasLateCheckOut ||
        specialRequests.length > 0) && (
        <Card className='mb-6'>
          <CardHeader>
            <h2 className={title({ size: 'sm' })}>
              Additional Services & Requests
            </h2>
          </CardHeader>
          <CardBody className='space-y-4'>
            {/* Extras */}
            {(extras?.hasBreakfast ||
              extras?.hasPets ||
              extras?.hasParking ||
              extras?.hasEarlyCheckIn ||
              extras?.hasLateCheckOut) && (
              <div>
                <p className='text-sm text-default-500 mb-2'>
                  Selected Services:
                </p>
                <div className='flex flex-wrap gap-2'>
                  {extras?.hasBreakfast && (
                    <Chip color='success' variant='flat'>
                      Breakfast (${extras.breakfastPrice})
                    </Chip>
                  )}
                  {extras?.hasPets && (
                    <Chip color='success' variant='flat'>
                      Pet-Friendly (${extras.petFee})
                    </Chip>
                  )}
                  {extras?.hasParking && (
                    <Chip color='success' variant='flat'>
                      Parking (${extras.parkingFee})
                    </Chip>
                  )}
                  {extras?.hasEarlyCheckIn && (
                    <Chip color='success' variant='flat'>
                      Early Check-in (${extras.earlyCheckInFee})
                    </Chip>
                  )}
                  {extras?.hasLateCheckOut && (
                    <Chip color='success' variant='flat'>
                      Late Check-out (${extras.lateCheckOutFee})
                    </Chip>
                  )}
                </div>
              </div>
            )}

            {/* Special Requests */}
            {specialRequests.length > 0 && (
              <>
                <Divider />
                <div>
                  <p className='text-sm text-default-500 mb-2'>
                    Special Requests:
                  </p>
                  <ul className='list-disc list-inside space-y-1'>
                    {specialRequests.map((request, index) => (
                      <li key={index} className='text-sm'>
                        {request}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      )}

      {/* Pricing Breakdown */}
      <Card className='mb-6'>
        <CardHeader>
          <h2 className={title({ size: 'sm' })}>Price Breakdown</h2>
        </CardHeader>
        <CardBody className='space-y-3'>
          <div className='flex justify-between items-center'>
            <span className='text-default-600'>
              ${booking.cabinPrice} × {booking.numNights} night
              {booking.numNights > 1 ? 's' : ''}
            </span>
            <span className='font-semibold'>
              ${booking.cabinPrice * booking.numNights}
            </span>
          </div>

          {extrasPrice > 0 && (
            <div className='flex justify-between items-center'>
              <span className='text-default-600'>Additional Services</span>
              <span className='font-semibold'>${extrasPrice}</span>
            </div>
          )}

          <Divider />

          <div className='flex justify-between items-center text-lg'>
            <span className='font-bold'>Total (before taxes)</span>
            <span className='font-bold text-success'>
              ${booking.totalPrice}
            </span>
          </div>

          {depositAmount > 0 && (
            <>
              <Divider />
              <div className='flex justify-between items-center'>
                <span className='text-default-600'>Deposit Required</span>
                <span className='font-semibold text-warning'>
                  ${depositAmount}
                </span>
              </div>
            </>
          )}

          <p className='text-xs text-default-500 mt-2'>
            Taxes and fees will be calculated and included in your final
            confirmation email.
          </p>
        </CardBody>
      </Card>

      {/* Payment Section */}
      {booking.cabin &&
        !booking.isPaid &&
        booking.status !== 'cancelled' &&
        (() => {
          const amountReceived = booking.amountPaid ?? 0;
          const isDepositDue = amountReceived < depositAmount;
          const remainingBalance = Math.max(
            0,
            booking.totalPrice - amountReceived
          );
          const amountToPay = isDepositDue
            ? depositAmount - amountReceived
            : remainingBalance;

          if (amountToPay <= 0) return null;

          return (
            <Card className='mb-6 border-2 border-success-200 dark:border-success-800'>
              <CardBody className='flex flex-col items-center gap-4 p-6'>
                <h3 className='text-lg font-semibold'>Complete Your Payment</h3>
                <p className='text-sm text-default-500 text-center'>
                  {isDepositDue
                    ? `Pay the remaining deposit of $${amountToPay} to secure your booking.`
                    : `Pay the remaining balance of $${amountToPay} to confirm your reservation.`}
                </p>
                <PaymentButton
                  amount={amountToPay}
                  bookingId={booking._id}
                  isDeposit={isDepositDue}
                  size='lg'
                />
              </CardBody>
            </Card>
          );
        })()}

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

      {/* Info Message */}
      <Card className='mt-6 bg-primary-50 dark:bg-primary-900/20'>
        <CardBody>
          <p className='text-sm text-center'>
            You will receive a confirmation email at{' '}
            <strong>{user?.emailAddresses[0]?.emailAddress}</strong> once your
            booking is reviewed and approved by our team.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
