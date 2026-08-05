'use client';

import BookingStats from '@/components/BookingStats';
import BookingsFilters, {
  type BookingsFiltersData,
} from '@/components/BookingsFilters';
import BookingsTable from '@/components/BookingsTable';
import { PlusIcon } from '@/components/icons';
import {
  useBookings,
  useDeleteBooking,
  useUpdateBooking,
} from '@/hooks/useBookings';
import { clearDetailMemory } from '@/hooks/useDetailPageMemory';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useURLFilters, bookingsFilterConfig } from '@/hooks/useURLFilters';
import type {
  PopulatedBooking,
  BookingsFilters as BookingsFiltersType,
} from '@/types';
import { Button } from '@heroui/button';
import { Card, CardBody } from '@heroui/card';
import { addToast } from '@heroui/toast';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, Suspense } from 'react';

function BookingsContent() {
  const router = useRouter();

  // Use URL-based filter state
  const { filters, updateFilter, updateFilters, resetFilters } =
    useURLFilters<BookingsFiltersType>({
      filterConfig: bookingsFilterConfig,
      basePath: '/bookings',
    });

  const {
    data: bookingsData,
    isLoading,
    error,
    mutate,
  } = useBookings({
    page: filters.page || 1,
    limit: filters.limit || 10,
    status: filters.status,
    search: filters.search,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  });

  const updateBooking = useUpdateBooking();
  const deleteBooking = useDeleteBooking();
  const { showConfirm, ConfirmDialog } = useConfirmDialog();

  // Clear detail page memory when landing on the list page
  useEffect(() => {
    clearDetailMemory('bookings');
  }, []);

  // Check for success message in URL (when coming back from new booking page)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('created') === 'true') {
      addToast({
        title: 'Success',
        description: 'Booking created successfully',
        color: 'success',
      });
      // Remove the query parameter from URL while preserving other filters
      urlParams.delete('created');
      const newURL = urlParams.toString()
        ? `/bookings?${urlParams.toString()}`
        : '/bookings';
      router.replace(newURL);
      // Refresh the bookings data
      mutate();
    }
  }, [mutate]);

  // Surface Clerk API warnings (e.g. when Clerk is down and customer data is unavailable)
  const lastClerkWarning = useRef<string | undefined>();
  useEffect(() => {
    const warning = bookingsData?._clerkWarning;
    if (warning && warning !== lastClerkWarning.current) {
      lastClerkWarning.current = warning;
      addToast({
        title: 'Customer data partially unavailable',
        description: warning,
        color: 'warning',
      });
    } else if (!warning) {
      lastClerkWarning.current = undefined;
    }
  }, [bookingsData?._clerkWarning]);

  const handlePageChange = (page: number) => {
    updateFilter('page', page, true); // Add to history for pagination
  };

  const handleFiltersChange = (newFilters: BookingsFiltersData) => {
    // Convert component filters to URL filters and reset page to 1
    updateFilters({
      status: newFilters.status,
      search: newFilters.search,
      sortBy: newFilters.sortBy,
      sortOrder: newFilters.sortOrder,
      page: 1, // Reset to first page when filters change
    });
  };

  const handleResetFilters = () => {
    resetFilters();
  };

  const handleStatusChange = async (bookingId: string, newStatus: string) => {
    const booking = bookingsData?.bookings.find(
      b => b._id.toString() === bookingId
    );
    if (booking) {
      try {
        await updateBooking.mutateAsync({
          _id: booking._id.toString(),
          status: newStatus as
            | 'unconfirmed'
            | 'confirmed'
            | 'checked-in'
            | 'checked-out'
            | 'cancelled',
        });
        // Manually revalidate SWR data
        mutate();
      } catch (error) {
        addToast({
          title: 'Status update failed',
          description:
            error instanceof Error
              ? error.message
              : 'Failed to update booking status',
          color: 'danger',
        });
      }
    }
  };

  const handleDelete = async (booking: PopulatedBooking) => {
    const guest = booking.guest || booking.customer;
    showConfirm({
      title: 'Delete Booking',
      message: `Are you sure you want to delete the booking for ${guest?.name || 'this guest'}? This action cannot be undone.`,
      confirmText: 'Delete',
      confirmColor: 'danger',
      onConfirm: async () => {
        try {
          await deleteBooking.mutateAsync(booking._id.toString());
          // Manually revalidate SWR data
          mutate();
        } catch (error) {
          addToast({
            title: 'Delete failed',
            description:
              error instanceof Error
                ? error.message
                : 'Failed to delete booking',
            color: 'danger',
          });
        }
      },
      isLoading: deleteBooking.isPending,
    });
  };

  if (error) {
    return (
      <div className='container mx-auto px-4 py-8'>
        <Card className='bg-danger-50 border-danger-200'>
          <CardBody>
            <p className='text-danger'>
              Error loading bookings: {error.message}
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className='container mx-auto px-4 py-8'>
      {/* Header */}
      <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8'>
        <div>
          <h1 className='text-3xl font-bold'>Bookings</h1>
          <p className='text-default-600 mt-1'>
            Manage cabin reservations and guest check-ins
          </p>
        </div>
        <div className='flex gap-2 w-full sm:w-auto'>
          <Button
            variant='bordered'
            onPress={() => router.push('/bookings/analytics')}
            className='flex-1 sm:flex-none'
          >
            Analytics
          </Button>
          <Button
            color='primary'
            startContent={<PlusIcon />}
            onPress={() => router.push('/bookings/new')}
            className='flex-1 sm:flex-none'
          >
            New Booking
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className='mb-8'>
        <BookingStats />
      </div>

      {/* Filters */}
      <div className='mb-8'>
        <BookingsFilters
          filters={{
            status: filters.status,
            search: filters.search,
            sortBy: filters.sortBy,
            sortOrder: filters.sortOrder,
          }}
          onFiltersChange={handleFiltersChange}
          onReset={handleResetFilters}
          totalCount={
            bookingsData?.pagination.totalBookings ||
            bookingsData?.bookings?.length ||
            0
          }
        />
      </div>

      {/* Bookings Table */}
      <div className='bg-content1 rounded-lg shadow-sm border border-default-200 p-6'>
        <BookingsTable
          bookings={bookingsData?.bookings || []}
          isLoading={isLoading}
          currentPage={filters.page || 1}
          totalPages={bookingsData?.pagination.totalPages || 1}
          onPageChange={handlePageChange}
          onStatusChange={handleStatusChange}
          onViewDetails={booking => router.push(`/bookings/${booking._id}`)}
          onEdit={booking => router.push(`/bookings/${booking._id}/edit`)}
          onDelete={handleDelete}
        />
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog />
    </div>
  );
}

export default function BookingsPage() {
  return (
    <Suspense
      fallback={
        <div className='container mx-auto px-4 py-8'>
          <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8'>
            <div>
              <h1 className='text-3xl font-bold'>Bookings</h1>
              <p className='text-default-600 mt-1'>
                Manage cabin reservations and guest check-ins
              </p>
            </div>
            <Button
              color='primary'
              startContent={<PlusIcon />}
              isDisabled
              className='w-full sm:w-auto'
            >
              New Booking
            </Button>
          </div>
          <Card>
            <CardBody>
              <div className='flex justify-center items-center py-8'>
                <div className='text-default-500'>Loading...</div>
              </div>
            </CardBody>
          </Card>
        </div>
      }
    >
      <BookingsContent />
    </Suspense>
  );
}
