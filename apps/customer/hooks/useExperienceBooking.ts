import { readResponse } from '@/lib/validations/read-response';
import {
  decodeExperienceHistory,
  decodeExperienceDetail,
} from '@/lib/validations/reservation-read-json';
import { useAuth } from '@clerk/nextjs';
import {
  fetchConfirmationDetail,
  type ConfirmationDetailOptions,
} from '@/hooks/useConfirmation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  ApiResponse,
  CreateExperienceBookingData,
  PopulatedExperienceBooking,
} from '@/types';

/**
 * Hook to create a new experience booking
 */
export const useCreateExperienceBooking = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      bookingData: CreateExperienceBookingData
    ): Promise<{
      data: PopulatedExperienceBooking;
      message?: string;
      success: boolean;
    }> => {
      const response = await fetch('/api/experience-bookings', {
        body: JSON.stringify(bookingData),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create experience booking');
      }
      return response.json();
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
        decodeExperienceHistory,
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
export const useCancelExperienceBooking = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      bookingId: string
    ): Promise<ApiResponse<PopulatedExperienceBooking>> => {
      const response = await fetch(`/api/experience-bookings/${bookingId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cancel experience booking');
      }

      return response.json();
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
