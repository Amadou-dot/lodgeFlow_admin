'use client';

import type { BookingStatus } from '@/lib/config';
import type { BookingStatusChangeHandler } from '@/types/booking-actions';
import { Button } from '@heroui/button';
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from '@heroui/dropdown';
import { MoreVertical } from 'lucide-react';

interface BookingActionData {
  _id: string;
  status: BookingStatus;
}

interface BookingActionsMenuProps<TBooking extends BookingActionData> {
  booking: TBooking;
  onStatusChange?: BookingStatusChangeHandler;
  onViewDetails?: (booking: TBooking) => void;
  onEdit?: (booking: TBooking) => void;
  onDelete?: (booking: TBooking) => void;
}

export default function BookingActionsMenu<TBooking extends BookingActionData>({
  booking,
  onStatusChange,
  onViewDetails,
  onEdit,
  onDelete,
}: BookingActionsMenuProps<TBooking>) {
  const menuItems = [];

  if (onViewDetails) {
    menuItems.push(
      <DropdownItem key='view' onPress={() => onViewDetails(booking)}>
        View Details
      </DropdownItem>
    );
  }

  if (onEdit && booking.status === 'unconfirmed') {
    menuItems.push(
      <DropdownItem key='edit' onPress={() => onEdit(booking)}>
        Edit Booking
      </DropdownItem>
    );
  }

  if (onStatusChange && booking.status === 'confirmed') {
    menuItems.push(
      <DropdownItem
        key='checkin'
        onPress={() =>
          onStatusChange({ bookingId: booking._id, status: 'checked-in' })
        }
      >
        Check In
      </DropdownItem>
    );
  }

  if (onStatusChange && booking.status === 'checked-in') {
    menuItems.push(
      <DropdownItem
        key='checkout'
        onPress={() =>
          onStatusChange({ bookingId: booking._id, status: 'checked-out' })
        }
      >
        Check Out
      </DropdownItem>
    );
  }

  if (onStatusChange && booking.status === 'unconfirmed') {
    menuItems.push(
      <DropdownItem
        key='cancel'
        className='text-danger'
        color='danger'
        onPress={() =>
          onStatusChange({ bookingId: booking._id, status: 'cancelled' })
        }
      >
        Cancel Booking
      </DropdownItem>
    );
  }

  if (onDelete) {
    menuItems.push(
      <DropdownItem
        key='delete'
        className='text-danger'
        color='danger'
        onPress={() => onDelete(booking)}
      >
        Delete Booking
      </DropdownItem>
    );
  }

  return (
    <Dropdown>
      <DropdownTrigger>
        <Button isIconOnly variant='light' size='sm'>
          <MoreVertical className='w-4 h-4' />
        </Button>
      </DropdownTrigger>
      <DropdownMenu>{menuItems}</DropdownMenu>
    </Dropdown>
  );
}
