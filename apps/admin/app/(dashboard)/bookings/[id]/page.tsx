'use client';

import {
  BookingDetailsHeader,
  BookingMainContent,
  BookingSidebar,
} from '@/components/BookingDetails';
import { ArrowLeftIcon } from '@/components/icons';
import {
  useBooking,
  useCheckInBooking,
  useCheckOutBooking,
  useDeleteBooking,
} from '@/hooks/useBookings';
import { useDetailPageMemory } from '@/hooks/useDetailPageMemory';
import { formatBookingDates } from '@/utils/bookingUtils';
import { Button } from '@heroui/button';
import { Spinner } from '@heroui/spinner';
import { addToast } from '@heroui/toast';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

export default function BookingDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = params.id?.toString();
  useDetailPageMemory('bookings');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Booking mutations
  const checkInMutation = useCheckInBooking();
  const checkOutMutation = useCheckOutBooking();
  const deleteMutation = useDeleteBooking();

  if (!bookingId) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='text-center'>
          <h1 className='text-2xl font-bold text-danger'>Invalid Booking ID</h1>
          <Button
            color='primary'
            variant='flat'
            startContent={<ArrowLeftIcon className='w-4 h-4' />}
            onPress={() => router.push('/bookings')}
            className='mt-4'
          >
            Back to Bookings
          </Button>
        </div>
      </div>
    );
  }

  const { data: booking, error, isLoading, mutate } = useBooking(bookingId);

  // Handle booking actions
  const handleCheckIn = async () => {
    if (!bookingId) return;
    setActionLoading('check-in');
    try {
      await checkInMutation.mutateAsync(bookingId);
      mutate(); // Refresh booking data
    } catch (error) {
      addToast({
        title: 'Error',
        description: 'Failed to check in booking',
        color: 'danger',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCheckOut = async () => {
    if (!bookingId) return;
    setActionLoading('check-out');
    try {
      await checkOutMutation.mutateAsync(bookingId);
      mutate(); // Refresh booking data
    } catch (error) {
      addToast({
        title: 'Error',
        description: 'Failed to check out booking',
        color: 'danger',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteSuccess = () => {
    router.push('/bookings');
  };

  if (isLoading) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <Spinner size='lg' label='Loading booking details...' />
      </div>
    );
  }

  if (error) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='text-center'>
          <h1 className='text-2xl font-bold text-danger mb-2'>
            Error Loading Booking
          </h1>
          <p className='text-default-500 mb-4'>{error.message}</p>
          <Button
            color='primary'
            variant='flat'
            startContent={<ArrowLeftIcon className='w-4 h-4' />}
            onPress={() => router.push('/bookings')}
          >
            Back to Bookings
          </Button>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='text-center'>
          <h1 className='text-2xl font-bold text-warning'>Booking Not Found</h1>
          <Button
            color='primary'
            variant='flat'
            startContent={<ArrowLeftIcon className='w-4 h-4' />}
            onPress={() => router.push('/bookings')}
            className='mt-4'
          >
            Back to Bookings
          </Button>
        </div>
      </div>
    );
  }

  const { dateRange, timeInfo } = formatBookingDates(
    booking.checkInDate.toString(),
    booking.checkOutDate.toString(),
    booking.numNights,
    booking.status
  );

  const isCancelable = booking.status !== 'cancelled';

  return (
    <div className='container mx-auto px-4 py-6 max-w-6xl'>
      <BookingDetailsHeader
        booking={booking}
        onBack={() => router.push('/bookings')}
        onBookingUpdated={() => mutate()}
        onDeleteSuccess={handleDeleteSuccess}
        deleteMutation={deleteMutation}
        isCancelable={isCancelable}
      />

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        <BookingMainContent
          booking={booking}
          dateRange={dateRange}
          timeInfo={timeInfo}
        />

        <BookingSidebar
          booking={booking}
          onCheckIn={handleCheckIn}
          onCheckOut={handleCheckOut}
          actionLoading={actionLoading}
          onBookingUpdated={mutate}
        />
      </div>
    </div>
  );
}
