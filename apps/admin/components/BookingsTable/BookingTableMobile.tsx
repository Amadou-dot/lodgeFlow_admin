'use client';

import type { PopulatedBooking } from '@/types';
import { Card, CardBody } from '@heroui/card';
import BookingCard from './BookingCard';

interface BookingTableMobileProps {
  bookings: PopulatedBooking[];
  isLoading: boolean;
  onStatusChange?: (bookingId: string, newStatus: string) => void;
  onViewDetails?: (booking: PopulatedBooking) => void;
  onEdit?: (booking: PopulatedBooking) => void;
  onDelete?: (booking: PopulatedBooking) => void;
}

export default function BookingTableMobile({
  bookings,
  isLoading,
  onStatusChange,
  onViewDetails,
  onEdit,
  onDelete,
}: BookingTableMobileProps) {
  if (isLoading && bookings.length === 0) {
    return (
      <div className='space-y-4'>
        {[...Array(3)].map((_, i) => (
          <Card key={i} className='animate-pulse'>
            <CardBody className='p-4'>
              <div className='flex items-center gap-3 mb-3'>
                <div className='w-8 h-8 bg-default-200 rounded-full' />
                <div className='flex-1'>
                  <div className='h-4 bg-default-200 rounded mb-1' />
                  <div className='h-3 bg-default-200 rounded w-2/3' />
                </div>
                <div className='w-16 h-6 bg-default-200 rounded' />
              </div>
              <div className='space-y-2'>
                <div className='h-3 bg-default-200 rounded w-1/3' />
                <div className='h-4 bg-default-200 rounded w-2/3' />
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className='text-center py-8 text-default-500'>No bookings found</div>
    );
  }

  return (
    <div className='space-y-3'>
      {bookings.map(booking => (
        <BookingCard
          key={booking._id.toString()}
          booking={booking}
          onStatusChange={onStatusChange}
          onViewDetails={onViewDetails}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
