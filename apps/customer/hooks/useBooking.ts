import { useSWRConfig } from 'swr';
import {
  fetchConfirmationDetail,
  type ConfirmationDetailOptions,
} from '@/hooks/useConfirmation';
import type {
  CreateBookingRequest,
  UpdateBookingDetailsInput,
} from '@/lib/validations/booking';
import type { BookingHistoryItem, BookingDetail } from '@/types/booking-read';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  ApiResponse,
  CancellationResponse,
  RefundEstimateResponse,
} from '@/types';

/**
 * Hook to create a new booking
 */
export const useCreateBooking = () => {
  const queryClient = useQueryClient();
  const { mutate } = useSWRConfig();

  return useMutation({
    mutationFn: async (
      bookingData: CreateBookingRequest
    ): Promise<ApiResponse<BookingDetail>> => {
      const response = await fetch('/api/bookings', {
        body: JSON.stringify(bookingData),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to create booking');
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate React Query cache and revalidate SWR
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['bookings-history'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['cabin-availability'] });
      void mutate(
        key =>
          typeof key === 'string' &&
          /^\/api\/cabins\/[^/]+\/availability$/.test(key)
      );
    },
  });
};

/**
 * Hook to fetch booking history for the current user
 * @param status - Optional status filter (unconfirmed, confirmed, checked-in, checked-out, cancelled)
 */
export const useBookingHistory = (status?: string) => {
  return useQuery({
    queryFn: async (): Promise<BookingHistoryItem[]> => {
      const url = status
        ? `/api/bookings/history?status=${status}`
        : '/api/bookings/history';

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch booking history');
      }

      const data: ApiResponse<BookingHistoryItem[]> = await response.json();
      return data.data || [];
    },
    queryKey: ['bookings-history', status],
  });
};

/**
 * Hook to fetch a single booking by ID
 */
export const useBookingById = (
  bookingId: string,
  options: ConfirmationDetailOptions = {}
) => {
  return useQuery({
    enabled: !!bookingId && options.enabled !== false,
    ...(options.mode === 'confirmation' ? { retry: false } : {}),
    queryFn: async (): Promise<BookingDetail | null> => {
      if (options.mode === 'confirmation') {
        return fetchConfirmationDetail<BookingDetail>({
          url: `/api/bookings/${bookingId}`,
          loadError: 'Failed to load booking',
          notFoundError: 'Booking not found',
          statusError: 'Failed to load booking',
        });
      }

      const response = await fetch(`/api/bookings/${bookingId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch booking');
      }

      const data: ApiResponse<BookingDetail> = await response.json();
      return data.data || null;
    },
    queryKey: ['booking', bookingId],
  });
};

/**
 * Hook to update a booking
 */
export const useUpdateBooking = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      bookingId,
      updates,
    }: {
      bookingId: string;
      updates: UpdateBookingDetailsInput;
    }): Promise<ApiResponse<BookingDetail>> => {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        body: JSON.stringify(updates),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update booking');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate specific booking and history
      queryClient.invalidateQueries({
        queryKey: ['booking', variables.bookingId],
      });
      queryClient.invalidateQueries({ queryKey: ['bookings-history'] });
    },
  });
};

/**
 * Hook to fetch refund estimate for a booking
 */
export const useRefundEstimate = (bookingId: string) => {
  return useQuery({
    enabled: !!bookingId,
    gcTime: 10 * 60 * 1000,
    queryFn: async (): Promise<RefundEstimateResponse | null> => {
      const response = await fetch(
        `/api/bookings/${bookingId}/refund-estimate`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch refund estimate');
      }

      const data: ApiResponse<RefundEstimateResponse> = await response.json();
      return data.data || null;
    },
    queryKey: ['refund-estimate', bookingId],
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook to cancel a booking with refund processing
 */
export const useCancelBooking = () => {
  const queryClient = useQueryClient();
  const { mutate } = useSWRConfig();

  return useMutation({
    mutationFn: async ({
      bookingId,
      reason,
    }: {
      bookingId: string;
      reason?: string;
    }): Promise<ApiResponse<CancellationResponse>> => {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        body: JSON.stringify({ reason }),
        headers: { 'Content-Type': 'application/json' },
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cancel booking');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['booking', variables.bookingId],
      });
      // Invalidate all booking-related queries
      queryClient.invalidateQueries({ queryKey: ['bookings-history'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({
        queryKey: ['refund-estimate', variables.bookingId],
      });
      queryClient.invalidateQueries({ queryKey: ['cabin-availability'] });
      void mutate(
        key =>
          typeof key === 'string' &&
          /^\/api\/cabins\/[^/]+\/availability$/.test(key)
      );
    },
  });
};
