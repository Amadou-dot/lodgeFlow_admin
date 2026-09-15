'use client';

import type { PopulatedBooking } from '@/types';
import {
  BookingTableDesktop,
  BookingTableMobile,
  BookingTablePagination,
} from './BookingsTable/';

interface BookingsTableProps {
  bookings: PopulatedBooking[];
  isLoading?: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onStatusChange?: (bookingId: string, newStatus: string) => void;
  onViewDetails?: (booking: PopulatedBooking) => void;
  onEdit?: (booking: PopulatedBooking) => void;
  onDelete?: (booking: PopulatedBooking) => void;
}

export default function BookingsTable({
  bookings,
  isLoading = false,
  currentPage,
  totalPages,
  onPageChange,
  onStatusChange,
  onViewDetails,
  onEdit,
  onDelete,
}: BookingsTableProps) {
  return (
    <div className='space-y-4'>
      {/* Mobile Cards Layout (visible on screens smaller than md) */}
      <div className='block md:hidden'>
        <BookingTableMobile
          bookings={bookings}
          isLoading={isLoading}
          onStatusChange={onStatusChange}
          onViewDetails={onViewDetails}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>

      {/* Desktop Table Layout (visible on md and larger screens) */}
      <div className='hidden md:block'>
        <BookingTableDesktop
          bookings={bookings}
          isLoading={isLoading}
          onStatusChange={onStatusChange}
          onViewDetails={onViewDetails}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>

      {/* Pagination */}
      <BookingTablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </div>
  );
}
