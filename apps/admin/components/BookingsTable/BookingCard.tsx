import type { PopulatedBooking } from '@/types';
import {
  formatBookingDates,
  getStatusColor,
  getStatusLabel,
} from '@/utils/bookingUtils';
import { Card, CardBody } from '@heroui/card';
import { Chip } from '@heroui/chip';
import { User } from '@heroui/user';
import BookingActionsMenu from './BookingActionsMenu';

interface BookingCardProps {
  booking: PopulatedBooking;
  onStatusChange?: (bookingId: string, newStatus: string) => void;
  onViewDetails?: (booking: PopulatedBooking) => void;
  onEdit?: (booking: PopulatedBooking) => void;
  onDelete?: (booking: PopulatedBooking) => void;
}

export default function BookingCard({
  booking,
  onStatusChange,
  onViewDetails,
  onEdit,
  onDelete,
}: BookingCardProps) {
  const guest = booking.guest || booking.customer;
  const checkInDate =
    booking.checkInDate instanceof Date
      ? booking.checkInDate.toISOString()
      : booking.checkInDate;
  const checkOutDate =
    booking.checkOutDate instanceof Date
      ? booking.checkOutDate.toISOString()
      : booking.checkOutDate;

  const { dateRange, timeInfo, showTimeInfo } = formatBookingDates(
    checkInDate,
    checkOutDate,
    booking.numNights,
    booking.status
  );

  return (
    <Card className='mb-4'>
      <CardBody className='p-4'>
        {/* Guest Information */}
        <div className='flex items-start justify-between mb-3'>
          <div className='flex-1 min-w-0'>
            <User
              name={guest?.name || 'N/A'}
              description={guest?.email || 'N/A'}
              avatarProps={{
                name: guest?.name,
                size: 'sm',
              }}
              classNames={{
                base: 'justify-start',
                wrapper: 'min-w-0 flex-1',
                name: 'text-sm font-medium truncate',
                description: 'text-xs text-default-500 truncate',
              }}
            />
          </div>
          <div className='flex-shrink-0 ml-3'>
            <BookingActionsMenu
              booking={booking}
              onStatusChange={onStatusChange}
              onViewDetails={onViewDetails}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </div>
        </div>

        {/* Status Row */}
        <div className='flex items-center justify-between mb-3'>
          <Chip
            color={getStatusColor(booking.status)}
            variant='flat'
            size='sm'
            className='text-xs'
          >
            {getStatusLabel(booking.status)}
          </Chip>
        </div>

        {/* Cabin Name */}
        <div className='mb-3'>
          <span className='text-xs text-default-500 uppercase tracking-wider'>
            Cabin
          </span>
          <p className='text-sm font-medium text-foreground truncate'>
            {booking.cabinName || booking.cabin?.name || 'N/A'}
          </p>
        </div>

        {/* Dates */}
        <div className='mb-3'>
          <span className='text-xs text-default-500 uppercase tracking-wider'>
            Stay Period
          </span>
          <div className={booking.status === 'cancelled' ? 'opacity-50' : ''}>
            {showTimeInfo && (
              <p className='text-xs font-medium text-foreground'>{timeInfo}</p>
            )}
            <p
              className={`text-xs ${booking.status === 'cancelled' ? 'text-default-400 line-through' : 'text-default-600'}`}
            >
              {dateRange}
            </p>
          </div>
        </div>

        {/* Amount */}
        <div>
          <span className='text-xs text-default-500 uppercase tracking-wider'>
            Total Amount
          </span>
          <div className='flex items-baseline gap-2'>
            <span className='text-sm font-semibold text-foreground'>
              ${booking.totalPrice}
            </span>
            <span className='text-xs text-default-500'>
              (${booking.cabinPrice} × {booking.numNights} night
              {booking.numNights !== 1 ? 's' : ''})
            </span>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
