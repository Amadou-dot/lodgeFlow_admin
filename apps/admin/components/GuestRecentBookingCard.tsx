'use client';

import type { RecentBooking } from '@/types';
import { getStatusColor } from '@/utils/bookingUtils';
import { Card, CardBody } from '@heroui/card';
import { Chip } from '@heroui/chip';

interface GuestRecentBookingCardProps {
  booking: RecentBooking;
  formatDate: (dateString: string) => string;
}

export default function GuestRecentBookingCard({
  booking,
  formatDate,
}: GuestRecentBookingCardProps) {
  return (
    <Card className='mb-3'>
      <CardBody className='p-4'>
        {/* Cabin Information */}
        <div className='flex items-center gap-3 mb-3'>
          {booking.cabin?.image && (
            <img
              alt={booking.cabin.name}
              className='w-12 h-12 rounded object-cover flex-shrink-0'
              src={booking.cabin.image}
            />
          )}
          <div className='flex-1 min-w-0'>
            <p className='font-medium text-foreground truncate'>
              {booking.cabin?.name || 'N/A'}
            </p>
            <div className='flex items-center gap-2 mt-1'>
              <Chip
                color={getStatusColor(booking.status)}
                size='sm'
                variant='flat'
                className='text-xs'
              >
                {booking.status}
              </Chip>
            </div>
          </div>
          <div className='text-right flex-shrink-0'>
            <p className='font-semibold text-foreground'>
              ${booking.totalPrice.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Dates */}
        <div className='text-sm'>
          <span className='text-xs text-default-500 uppercase tracking-wider'>
            Stay Period
          </span>
          <div className='mt-1'>
            <p className='text-sm text-foreground'>
              {formatDate(
                typeof booking.checkInDate === 'string'
                  ? booking.checkInDate
                  : booking.checkInDate.toISOString()
              )}
            </p>
            <p className='text-xs text-default-600'>
              to{' '}
              {formatDate(
                typeof booking.checkOutDate === 'string'
                  ? booking.checkOutDate
                  : booking.checkOutDate.toISOString()
              )}
            </p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
