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
 * Successful mutations invalidate related React Query caches and revalidate
 * mounted SWR booking reads in the current provider.
 *
 * @see hooks/useCabins.ts - Same pattern for cabin operations
 * @see hooks/useCustomers.ts - Same pattern for customer operations
 */

import { SWR_CONFIG } from '@/lib/config';
import { resourceReadKey } from '@/hooks/resourceReadKey';
import type { BookingsFilters } from '@/types';
import type { AdminBooking, BookingByEmail } from '@/types/booking-read';
import { useRef } from 'react';
import { z } from 'zod';
import {
  bookingListResponse,
  bookingDetailResponse,
  bookingCollectionWriteResponse,
  bookingByEmailResponse,
  bookingDeleteResponse,
} from '@/lib/validations/booking-json';
import type { CreateBookingInput, UpdateBookingInput } from '@/types/api';
import { addToast } from '@heroui/toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import useSWR, { useSWRConfig } from 'swr';

const isBookingReadKey = resourceReadKey('/api/bookings');

const useRefreshBookingCaches = () => {
  const queryClient = useQueryClient();
  const { mutate } = useSWRConfig();

  return () => {
    queryClient.invalidateQueries({ queryKey: ['bookings'] });
    queryClient.invalidateQueries({ queryKey: ['activities'] });
    queryClient.invalidateQueries({ queryKey: ['overview'] });
    queryClient.invalidateQueries({ queryKey: ['booking-analytics'] });
    queryClient.invalidateQueries({ queryKey: ['booking-stats'] });
    queryClient.invalidateQueries({ queryKey: ['sales'] });
    queryClient.invalidateQueries({ queryKey: ['durations'] });
    // A read refresh failure must not turn the successful write into a retry.
    void mutate(isBookingReadKey).catch(() => {});
  };
};

const errorBody = z.object({
  success: z.literal(false).optional(),
  error: z.string().min(1),
});
function matches<T>(body: unknown, schema: z.ZodType<T>): body is T {
  return schema.safeParse(body).success;
}
async function readResponse<T>({
  response,
  schema,
  fallback,
  showHttpError = true,
}: {
  response: Response;
  schema: z.ZodType<T>;
  fallback: string;
  showHttpError?: boolean;
}): Promise<T> {
  if (!response.ok && !showHttpError) throw new Error(fallback);
  const body: unknown = await response.json().catch(() => undefined);
  if (response.ok && matches(body, schema)) return body;
  const failure = errorBody.safeParse(body);
  throw new Error(failure.success ? failure.data.error : fallback);
}

const fetcher = async (url: string) => {
  const {
    data: bookings,
    pagination,
    _clerkWarning,
  } = await readResponse({
    response: await fetch(url),
    schema: bookingListResponse,
    fallback: 'Failed to fetch bookings',
    showHttpError: false,
  });
  return { bookings, pagination, _clerkWarning };
};

async function readCollectionWrite(
  response: Response,
  fallback: string
): Promise<AdminBooking> {
  const result = await readResponse({
    response,
    schema: bookingCollectionWriteResponse,
    fallback,
  });
  return result.success ? result.data : result;
}

// Fetch bookings with filters and pagination using SWR
export const useBookings = (filters: BookingsFilters = {}) => {
  const params = new URLSearchParams();

  if (filters.page) params.append('page', filters.page.toString());
  if (filters.limit) params.append('limit', filters.limit.toString());
  if (filters.status) params.append('status', filters.status);
  if (filters.search) params.append('search', filters.search);
  if (filters.sortBy) params.append('sortBy', filters.sortBy);
  if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

  const { data, error, isLoading, mutate } = useSWR<
    Awaited<ReturnType<typeof fetcher>>
  >(`/api/bookings?${params.toString()}`, fetcher, {
    keepPreviousData: SWR_CONFIG.KEEP_PREVIOUS_DATA,
    revalidateOnFocus: SWR_CONFIG.REVALIDATE_ON_FOCUS,
    dedupingInterval: SWR_CONFIG.DEDUPING_INTERVAL,
  });

  return {
    data,
    error,
    isLoading,
    mutate, // For manual revalidation
  };
};

// Fetch a single booking by ID
export const useBooking = (id: string) => {
  const { data, error, isLoading, mutate } = useSWR<AdminBooking>(
    id ? `/api/bookings/${id}` : null,
    async (url: string) => {
      const result = await readResponse({
        response: await fetch(url),
        schema: bookingDetailResponse,
        fallback: 'Failed to fetch booking',
        showHttpError: false,
      });
      if (result.data._id !== id.toLowerCase())
        throw new Error('Failed to fetch booking');
      return result.data;
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
  const { data, error, isLoading, mutate } = useSWR<BookingByEmail>(
    email ? `/api/bookings/by-email?email=${encodeURIComponent(email)}` : null,
    async (url: string) => {
      const result = await readResponse({
        response: await fetch(url),
        schema: bookingByEmailResponse,
        fallback: 'Failed to fetch booking',
        showHttpError: false,
      });
      return result.data;
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
  const refreshBookingCaches = useRefreshBookingCaches();

  return useMutation({
    mutationFn: async (
      bookingData: CreateBookingInput
    ): Promise<AdminBooking> => {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData),
      });

      return readCollectionWrite(response, 'Failed to create booking');
    },
    onSuccess: refreshBookingCaches,
  });
};

// Record payment for a booking
export const useRecordPayment = () => {
  // A transport or acknowledgement failure may follow a committed PATCH.
  // Keep the same reference until the server confirms the receipt.
  const pending = useRef<{ bookingId: string; receiptId: string } | null>(null);
  const refreshBookingCaches = useRefreshBookingCaches();

  return useMutation({
    mutationFn: async (data: {
      bookingId: string;
      paymentMethod: 'cash' | 'card' | 'bank-transfer' | 'online';
      amountPaid: number;
      notes?: string;
    }): Promise<AdminBooking> => {
      const { bookingId, ...paymentData } = data;
      if (pending.current?.bookingId !== bookingId) {
        pending.current = { bookingId, receiptId: crypto.randomUUID() };
      }
      const attempt = pending.current;

      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordPayment: { ...paymentData, receiptId: attempt.receiptId },
        }),
      });

      const { data: booking } = await readResponse({
        response,
        schema: bookingDetailResponse,
        fallback: 'Failed to record payment',
      });
      if (
        booking._id !== bookingId.toLowerCase() ||
        !booking.payments?.some(
          receipt =>
            receipt.id === attempt.receiptId &&
            receipt.amount === paymentData.amountPaid &&
            receipt.method === paymentData.paymentMethod
        )
      ) {
        throw new Error('Failed to record payment');
      }
      if (pending.current === attempt) pending.current = null;
      return booking;
    },
    onSuccess: refreshBookingCaches,
  });
};

// Update an existing booking
export const useUpdateBooking = () => {
  const refreshBookingCaches = useRefreshBookingCaches();

  return useMutation({
    mutationFn: async (
      updateData: UpdateBookingInput
    ): Promise<AdminBooking> => {
      const response = await fetch('/api/bookings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      const booking = await readCollectionWrite(
        response,
        'Failed to update booking'
      );
      if (
        booking._id !== updateData._id.toLowerCase() ||
        (updateData.status !== undefined &&
          booking.status !== updateData.status)
      )
        throw new Error('Failed to update booking');
      return booking;
    },
    onSuccess: () => {
      refreshBookingCaches();
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
  const refreshBookingCaches = useRefreshBookingCaches();

  return useMutation({
    mutationFn: async (bookingId: string): Promise<void> => {
      const response = await fetch(`/api/bookings?id=${bookingId}`, {
        method: 'DELETE',
      });

      await readResponse({
        response,
        schema: bookingDeleteResponse,
        fallback: 'Failed to delete booking',
        showHttpError: false,
      });
    },
    onSuccess: refreshBookingCaches,
  });
};

function useBookingTransition({
  status,
  fallback,
}: {
  status: 'checked-in' | 'checked-out' | 'confirmed';
  fallback: string;
}) {
  const refreshBookingCaches = useRefreshBookingCaches();
  return useMutation({
    mutationFn: async (bookingId: string): Promise<AdminBooking> => {
      const response = await fetch('/api/bookings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _id: bookingId, status }),
      });
      const booking = await readCollectionWrite(response, fallback);
      if (booking._id !== bookingId.toLowerCase() || booking.status !== status)
        throw new Error(fallback);
      return booking;
    },
    onSuccess: refreshBookingCaches,
  });
}
export const useCheckInBooking = () =>
  useBookingTransition({
    status: 'checked-in',
    fallback: 'Failed to check in booking',
  });
export const useCheckOutBooking = () =>
  useBookingTransition({
    status: 'checked-out',
    fallback: 'Failed to check out booking',
  });
export const useConfirmBooking = () =>
  useBookingTransition({
    status: 'confirmed',
    fallback: 'Failed to confirm booking',
  });
