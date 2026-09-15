'use client';

/**
 * Booking data fetching hooks
 *
 * Data Fetching Strategy:
 * -----------------------
 * This application uses a dual-library approach for data fetching:
 *
 * 1. SWR (for reads):
 *    - useBookings, useBooking, useBookingByEmail
 *    - Handles automatic caching, revalidation, and request deduplication
 *    - Provides keepPreviousData for smooth UI transitions
 *    - Revalidates on window focus (configurable)
 *
 * 2. TanStack Query (for mutations):
 *    - useCreateBooking, useUpdateBooking, useDeleteBooking, etc.
 *    - Handles mutation state (isPending, isError, isSuccess)
 *    - Provides automatic cache invalidation after mutations
 *    - Enables optimistic updates when needed
 *
 * Cache Invalidation Flow:
 * ------------------------
 * When a mutation succeeds, we invalidate related React Query caches.
 * SWR caches are revalidated automatically on focus, or can be manually
 * triggered via the mutate() function returned by each read hook.
 *
 * @see hooks/useCabins.ts - Same pattern for cabin operations
 * @see hooks/useCustomers.ts - Same pattern for customer operations
 */

import { SWR_CONFIG } from '@/lib/config';
import type { BookingsFilters, PopulatedBooking } from '@/types';
import type { CreateBookingInput, UpdateBookingInput } from '@/types/api';
import { addToast } from '@heroui/toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import useSWR from 'swr';

interface BookingsResponse {
  bookings: PopulatedBooking[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalBookings: number;
    limit: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  _clerkWarning?: string;
}

// Fetcher function for SWR
const fetcher = (url: string): Promise<BookingsResponse> =>
  fetch(url)
    .then(res => {
      if (!res.ok) {
        throw new Error('Failed to fetch bookings');
      }
      return res.json();
    })
    .then(result => {
      // Handle new API response format
      if (result.success) {
        return {
          bookings: result.data as PopulatedBooking[],
          pagination: result.pagination,
          _clerkWarning: result._clerkWarning,
        };
      }
      throw new Error(result.error || 'Failed to fetch bookings');
    });

// Fetch bookings with filters and pagination using SWR
export const useBookings = (filters: BookingsFilters = {}) => {
  const params = new URLSearchParams();

  if (filters.page) params.append('page', filters.page.toString());
  if (filters.limit) params.append('limit', filters.limit.toString());
  if (filters.status) params.append('status', filters.status);
  if (filters.search) params.append('search', filters.search);
  if (filters.sortBy) params.append('sortBy', filters.sortBy);
  if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

  const { data, error, isLoading, mutate } = useSWR<BookingsResponse>(
    `/api/bookings?${params.toString()}`,
    fetcher,
    {
      keepPreviousData: SWR_CONFIG.KEEP_PREVIOUS_DATA,
      revalidateOnFocus: SWR_CONFIG.REVALIDATE_ON_FOCUS,
      dedupingInterval: SWR_CONFIG.DEDUPING_INTERVAL,
    }
  );

  return {
    data,
    error,
    isLoading,
    mutate, // For manual revalidation
  };
};

// Fetch a single booking by ID
export const useBooking = (id: string) => {
  const { data, error, isLoading, mutate } = useSWR<PopulatedBooking>(
    id ? `/api/bookings/${id}` : null,
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch booking');
      }
      const result = await response.json();
      if (result.success) {
        return result.data as PopulatedBooking;
      }
      throw new Error(result.error || 'Failed to fetch booking');
    },
    {
      keepPreviousData: SWR_CONFIG.KEEP_PREVIOUS_DATA,
      revalidateOnFocus: SWR_CONFIG.REVALIDATE_ON_FOCUS,
      dedupingInterval: SWR_CONFIG.DEDUPING_INTERVAL,
    }
  );

  return {
    data,
    error,
    isLoading,
    mutate,
  };
};

// Fetch a single booking by email
export const useBookingByEmail = (email: string) => {
  const { data, error, isLoading, mutate } = useSWR<PopulatedBooking>(
    email ? `/api/bookings/by-email?email=${encodeURIComponent(email)}` : null,
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch booking');
      }
      const result = await response.json();
      if (result.success) {
        return result.data as PopulatedBooking;
      }
      throw new Error(result.error || 'Failed to fetch booking');
    },
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );

  return {
    data,
    error,
    isLoading,
    mutate,
  };
};

// Create a new booking
export const useCreateBooking = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      bookingData: CreateBookingInput
    ): Promise<PopulatedBooking> => {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create booking');
      }
      const result = await response.json();
      return result.success ? result.data : result;
    },
    onSuccess: () => {
      // Invalidate React Query cache and revalidate SWR
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['booking-analytics'] });
      // Note: SWR will be revalidated automatically on focus or manually via mutate
    },
  });
};

// Record payment for a booking
export const useRecordPayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      bookingId: string;
      paymentMethod: 'cash' | 'card' | 'bank-transfer' | 'online';
      amountPaid: number;
      notes?: string;
    }): Promise<PopulatedBooking> => {
      const { bookingId, ...paymentData } = data;

      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordPayment: paymentData }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to record payment');
      }

      const result = await response.json();
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['booking-analytics'] });
    },
  });
};

// Update an existing booking
export const useUpdateBooking = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      updateData: UpdateBookingInput
    ): Promise<PopulatedBooking> => {
      const response = await fetch('/api/bookings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to update booking');
      }
      const result = await response.json();
      return result.success ? result.data : result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['booking-analytics'] });
      addToast({
        title: 'Booking updated',
        description: 'The booking has been updated successfully.',
        color: 'success',
      });
    },
    onError: (error: Error) => {
      addToast({
        title: 'Update failed',
        description: error.message,
        color: 'danger',
      });
    },
  });
};

// Delete a booking
export const useDeleteBooking = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookingId: string): Promise<void> => {
      const response = await fetch(`/api/bookings?id=${bookingId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete booking');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['booking-analytics'] });
    },
  });
};

// Check in a booking
export const useCheckInBooking = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookingId: string): Promise<PopulatedBooking> => {
      const response = await fetch('/api/bookings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _id: bookingId,
          status: 'checked-in',
          checkInTime: new Date(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to check in booking');
      }

      const result = await response.json();
      return result.success ? result.data : result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['booking-analytics'] });
    },
  });
};

// Check out a booking
export const useCheckOutBooking = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookingId: string): Promise<PopulatedBooking> => {
      const response = await fetch('/api/bookings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _id: bookingId,
          status: 'checked-out',
          checkOutTime: new Date(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to check out booking');
      }

      const result = await response.json();
      return result.success ? result.data : result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['booking-analytics'] });
    },
  });
};

// Confirm a booking
export const useConfirmBooking = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookingId: string): Promise<PopulatedBooking> => {
      const response = await fetch('/api/bookings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _id: bookingId,
          status: 'confirmed',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to confirm booking');
      }

      const result = await response.json();
      return result.success ? result.data : result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['booking-analytics'] });
    },
  });
};
