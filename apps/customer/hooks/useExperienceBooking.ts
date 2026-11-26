import { useCustomerWriteScope } from './useCustomerWriteScope';
import { readMutationResponse } from '@/lib/validations/mutation-response';
import { readResponse } from '@/lib/validations/read-response';
import {
  experienceMutationResult,
  decodeExperienceHistory,
  decodeExperienceDetail,
} from '@/lib/validations/reservation-read-json';
import { useAuth } from '@clerk/nextjs';
import {
  fetchConfirmationDetail,
  type ConfirmationDetailOptions,
} from '@/hooks/useConfirmation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CreateExperienceBookingData } from '@/types';

/**
 * Hook to create a new experience booking
 */
export const useCreateExperienceBooking = (listingId: string) => {
  const scope = useCustomerWriteScope([listingId]);
  const queryClient = useQueryClient();

  return useMutation({
    meta: scope.meta,
    retry: false,
    mutationFn: async (bookingData: CreateExperienceBookingData, context) => {
      const userId = scope.customerIdFor(context, bookingData.experienceId);
      const request = fetch('/api/experience-bookings', {
        body: JSON.stringify(bookingData),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });

      return readMutationResponse({
        request,
        status: 201,
        schema: experienceMutationResult({
          customerId: userId,
          listingId: bookingData.experienceId,
        }),
        fallback: 'Failed to create experience booking',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['experience-bookings'] });
      queryClient.invalidateQueries({
        queryKey: ['experience-bookings-history'],
      });
    },
  });
};

/**
 * Hook to fetch experience booking history for the current user
 */
export const useExperienceBookingHistory = (status?: string) => {
  const { isLoaded, isSignedIn, userId, sessionId } = useAuth();
  return useQuery({
    enabled: isLoaded && isSignedIn && !!userId && !!sessionId,
    queryFn: async ({ signal }) => {
      const url = status
        ? `/api/experience-bookings/history?status=${status}`
        : '/api/experience-bookings/history';

      const response = await fetch(url, { signal });

      return readResponse(
        response,
        decodeExperienceHistory({ userId, status }),
        'Failed to fetch experience booking history'
      );
    },
    queryKey: ['experience-bookings-history', status, userId, sessionId],
  });
};

/**
 * Hook to fetch a single experience booking by ID
 */
export const useExperienceBookingById = (
  bookingId: string,
  options: ConfirmationDetailOptions = {}
) => {
  const queryClient = useQueryClient();
  return useQuery({
    enabled: !!bookingId && options.enabled !== false,
    ...(options.mode === 'confirmation' ? { retry: false } : {}),
    queryFn: async context => {
      const decode = decodeExperienceDetail(bookingId);
      if (options.mode === 'confirmation') {
        const { signal } = context;
        return fetchConfirmationDetail({
          decode,
          signal,
          url: `/api/experience-bookings/${bookingId}`,
          loadError: 'Failed to load booking',
          notFoundError: 'Booking not found',
          onUnavailable: () => {
            queryClient.setQueryData(['experience-booking', bookingId], null);
          },
        });
      }

      const response = await fetch(`/api/experience-bookings/${bookingId}`);
      return readResponse(
        response,
        decode,
        'Failed to fetch experience booking'
      );
    },
    queryKey: ['experience-booking', bookingId],
  });
};

/**
 * Hook to cancel an experience booking
 */
export const useCancelExperienceBooking = (bookingIds: readonly string[]) => {
  const scope = useCustomerWriteScope(bookingIds);
  const queryClient = useQueryClient();

  return useMutation({
    meta: scope.meta,
    mutationFn: async (bookingId: string, context) => {
      const userId = scope.customerIdFor(context, bookingId);
      const request = fetch(`/api/experience-bookings/${bookingId}`, {
        method: 'DELETE',
      });

      return readMutationResponse({
        request,
        status: 200,
        schema: experienceMutationResult({ customerId: userId, id: bookingId }),
        fallback: 'Failed to cancel experience booking',
      });
    },
    onSuccess: (_, bookingId) => {
      queryClient.invalidateQueries({
        queryKey: ['experience-booking', bookingId],
      });
      queryClient.invalidateQueries({
        queryKey: ['experience-bookings-history'],
      });
      queryClient.invalidateQueries({ queryKey: ['experience-bookings'] });
    },
  });
};
