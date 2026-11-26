import { useCustomerWriteScope } from './useCustomerWriteScope';
import { readResponse } from '@/lib/validations/read-response';
import {
  createdBookingResult,
  updatedBookingResult,
  decodeBookingHistory,
  decodeBookingDetail,
} from '@/lib/validations/booking-read-json';
import {
  cancellationResult,
  decodeRefundEstimate,
} from '@/lib/validations/cancellation-json';
import { useAuth } from '@clerk/nextjs';
import { useSWRConfig } from 'swr';
import {
  fetchConfirmationDetail,
  type ConfirmationDetailOptions,
} from '@/hooks/useConfirmation';
import type {
  CreateBookingRequest,
  UpdateBookingDetailsInput,
} from '@/lib/validations/booking';
import { readMutationResponse } from '@/lib/validations/mutation-response';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { RefundEstimateResponse } from '@/types';

/**
 * Hook to create a new booking
 */
export const useCreateBooking = (cabinId: string) => {
  const scope = useCustomerWriteScope([cabinId]);
  const queryClient = useQueryClient();
  const { mutate } = useSWRConfig();

  return useMutation({
    meta: scope.meta,
    retry: false,
    mutationFn: async (bookingData: CreateBookingRequest, context) => {
      const userId = scope.customerIdFor(context, bookingData.cabinId);
      const request = fetch('/api/bookings', {
        body: JSON.stringify(bookingData),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });

      return readMutationResponse({
        request,
        status: 201,
        schema: createdBookingResult({
          customerId: userId,
          selection: bookingData,
        }),
        fallback: 'Failed to create booking',
      });
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
  const { isLoaded, isSignedIn, userId, sessionId } = useAuth();
  return useQuery({
    enabled: isLoaded && isSignedIn && !!userId && !!sessionId,
    queryFn: async ({ signal }) => {
      const url = status
        ? `/api/bookings/history?status=${status}`
        : '/api/bookings/history';

      const response = await fetch(url, { signal });

      return readResponse(
        response,
        decodeBookingHistory,
        'Failed to fetch booking history'
      );
    },
    queryKey: ['bookings-history', status, userId, sessionId],
  });
};

/**
 * Hook to fetch a single booking by ID
 */
export const useBookingById = (
  bookingId: string,
  options: ConfirmationDetailOptions = {}
) => {
  const queryClient = useQueryClient();
  return useQuery({
    enabled: !!bookingId && options.enabled !== false,
    ...(options.mode === 'confirmation' ? { retry: false } : {}),
    queryFn: async context => {
      const decode = decodeBookingDetail(bookingId);
      if (options.mode === 'confirmation') {
        const { signal } = context;
        return fetchConfirmationDetail({
          decode,
          signal,
          url: `/api/bookings/${bookingId}`,
          loadError: 'Failed to load booking',
          notFoundError: 'Booking not found',
          statusError: 'Failed to load booking',
          onUnavailable: () => {
            queryClient.setQueryData(['booking', bookingId], null);
          },
        });
      }

      const response = await fetch(`/api/bookings/${bookingId}`);
      return readResponse(response, decode, 'Failed to fetch booking');
    },
    queryKey: ['booking', bookingId],
  });
};

/**
 * Hook to update a booking
 */
export const useUpdateBooking = (selectedId: string | undefined) => {
  const scope = useCustomerWriteScope(selectedId ? [selectedId] : []);
  const queryClient = useQueryClient();

  return useMutation({
    meta: scope.meta,
    mutationFn: async (
      {
        bookingId,
        updates,
      }: {
        bookingId: string;
        updates: UpdateBookingDetailsInput;
      },
      context
    ) => {
      const userId = scope.customerIdFor(context, bookingId);
      const request = fetch(`/api/bookings/${bookingId}`, {
        body: JSON.stringify(updates),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      });

      return readMutationResponse({
        request,
        status: 200,
        schema: updatedBookingResult({
          customerId: userId,
          id: bookingId,
          updates,
        }),
        fallback: 'Failed to update booking',
      });
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

      return readResponse(
        response,
        decodeRefundEstimate,
        'Failed to fetch refund estimate'
      );
    },
    queryKey: ['refund-estimate', bookingId],
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook to cancel a booking with refund processing
 */
export const useCancelBooking = (selectedId: string | undefined) => {
  const scope = useCustomerWriteScope(selectedId ? [selectedId] : []);
  const queryClient = useQueryClient();
  const { mutate } = useSWRConfig();

  return useMutation({
    meta: scope.meta,
    mutationFn: async (
      {
        bookingId,
        reason,
      }: {
        bookingId: string;
        reason?: string;
      },
      context
    ) => {
      const userId = scope.customerIdFor(context, bookingId);
      const request = fetch(`/api/bookings/${bookingId}`, {
        body: JSON.stringify({ reason }),
        headers: { 'Content-Type': 'application/json' },
        method: 'DELETE',
      });

      return readMutationResponse({
        request,
        status: 200,
        schema: cancellationResult({ customerId: userId, id: bookingId }),
        fallback: 'Failed to cancel booking',
      });
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
