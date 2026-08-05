'use client';

import type { PopulatedBooking } from '@/types';
import {
  formatBookingDates,
  getStatusColor,
  getStatusLabel,
} from '@/utils/bookingUtils';
import { Chip } from '@heroui/chip';
import { User } from '@heroui/user';
import BookingActionsMenu from './BookingActionsMenu';

interface BookingTableCellProps {
  booking: PopulatedBooking;
  columnKey: string;
  onStatusChange?: (bookingId: string, newStatus: string) => void;
  onViewDetails?: (booking: PopulatedBooking) => void;
  onEdit?: (booking: PopulatedBooking) => void;
  onDelete?: (booking: PopulatedBooking) => void;
}

export default function BookingTableCell({
  booking,
  columnKey,
  onStatusChange,
  onViewDetails,
  onEdit,
  onDelete,
}: BookingTableCellProps) {
  switch (columnKey) {
    case 'cabin':
      return (
        <div className='font-medium text-foreground truncate'>
          {booking.cabinName || booking.cabin?.name || 'N/A'}
        </div>
      );

    case 'guest': {
      const guest = booking.guest || booking.customer;
      return (
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
            name: 'truncate',
            description: 'truncate',
          }}
        />
      );
    }

    case 'dates': {
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
        <div
          className={`min-w-0 ${booking.status === 'cancelled' ? 'opacity-50' : ''}`}
        >
          {showTimeInfo && (
            <div className='text-sm font-medium text-foreground mb-1 truncate'>
              {timeInfo}
            </div>
          )}
          <div
            className={`text-sm truncate ${booking.status === 'cancelled' ? 'text-default-400 line-through' : 'text-default-600'}`}
          >
            {dateRange}
          </div>
        </div>
      );
    }

    case 'status': {
      return (
        <Chip color={getStatusColor(booking.status)} variant='flat' size='sm'>
          {getStatusLabel(booking.status)}
        </Chip>
      );
    }

    case 'amount': {
      return (
        <div className='text-right min-w-0'>
          <div className='font-semibold text-foreground truncate'>
            ${booking.totalPrice}
          </div>
          <div className='text-xs text-default-500 truncate'>
            ${booking.cabinPrice} × {booking.numNights} night
            {booking.numNights !== 1 ? 's' : ''}
          </div>
        </div>
      );
    }

    case 'actions': {
      return (
        <BookingActionsMenu
          booking={booking}
          onStatusChange={onStatusChange}
          onViewDetails={onViewDetails}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      );
    }

    default:
      return null;
  }
}
