'use client';

import type { PopulatedBooking } from '@/types';
import { Button } from '@heroui/button';
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from '@heroui/dropdown';
import { MoreVertical } from 'lucide-react';

interface BookingActionsMenuProps {
  booking: PopulatedBooking;
  onStatusChange?: (bookingId: string, newStatus: string) => void;
  onViewDetails?: (booking: PopulatedBooking) => void;
  onEdit?: (booking: PopulatedBooking) => void;
  onDelete?: (booking: PopulatedBooking) => void;
}

export default function BookingActionsMenu({
  booking,
  onStatusChange,
  onViewDetails,
  onEdit,
  onDelete,
}: BookingActionsMenuProps) {
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

  if (onStatusChange && booking.status === 'unconfirmed') {
    menuItems.push(
      <DropdownItem
        key='checkin'
        onPress={() => onStatusChange(booking._id.toString(), 'checked-in')}
      >
        Check In
      </DropdownItem>
    );
  }

  if (onStatusChange && booking.status === 'checked-in') {
    menuItems.push(
      <DropdownItem
        key='checkout'
        onPress={() => onStatusChange(booking._id.toString(), 'checked-out')}
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
        onPress={() => onStatusChange(booking._id.toString(), 'cancelled')}
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
