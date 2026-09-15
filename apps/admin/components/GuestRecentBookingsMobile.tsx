'use client';

import { PlusIcon } from '@/components/icons';
import { Button } from '@heroui/button';
import type { RecentBooking } from '@/types';
import GuestRecentBookingCard from './GuestRecentBookingCard';

interface GuestRecentBookingsMobileProps {
  recentBookings: RecentBooking[];
  formatDate: (dateString: string) => string;
  onNewBooking: () => void;
}

export default function GuestRecentBookingsMobile({
  recentBookings,
  formatDate,
  onNewBooking,
}: GuestRecentBookingsMobileProps) {
  if (!recentBookings || recentBookings.length === 0) {
    return (
      <div className='text-center py-8'>
        <p className='text-default-600 mb-4'>No bookings found</p>
        <Button
          color='primary'
          startContent={<PlusIcon size={18} />}
          onPress={onNewBooking}
          className='w-full'
        >
          Create First Booking
        </Button>
      </div>
    );
  }

  return (
    <div>
      {recentBookings.map(booking => (
        <GuestRecentBookingCard
          key={booking._id}
          booking={booking}
          formatDate={formatDate}
        />
      ))}
    </div>
  );
}
