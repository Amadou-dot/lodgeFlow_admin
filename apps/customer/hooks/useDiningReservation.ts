import { readResponse } from '@/lib/validations/read-response';
import {
  decodeDiningHistory,
  decodeDiningDetail,
} from '@/lib/validations/reservation-read-json';
import { useAuth } from '@clerk/nextjs';
import {
  fetchConfirmationDetail,
  type ConfirmationDetailOptions,
} from '@/hooks/useConfirmation';
import { diningDayAvailabilityResponseSchema } from '@/lib/validations/reservation-availability';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  ApiResponse,
  CreateDiningReservationData,
  PopulatedDiningReservation,
} from '@/types';

/**
 * Hook to create a new dining reservation
 */
export const useCreateDiningReservation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      reservationData: CreateDiningReservationData
    ): Promise<{
      data: PopulatedDiningReservation;
      message?: string;
      success: boolean;
    }> => {
      const response = await fetch('/api/dining-reservations', {
        body: JSON.stringify(reservationData),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create dining reservation');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dining-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['dining-availability'] });
      queryClient.invalidateQueries({
        queryKey: ['dining-reservations-history'],
      });
    },
  });
};

/**
 * Hook to fetch dining reservation history for the current user
 */
export const useDiningReservationHistory = (status?: string) => {
  const { isLoaded, isSignedIn, userId, sessionId } = useAuth();
  return useQuery({
    enabled: isLoaded && isSignedIn && !!userId && !!sessionId,
    queryFn: async ({ signal }) => {
      const url = status
        ? `/api/dining-reservations/history?status=${status}`
        : '/api/dining-reservations/history';

      const response = await fetch(url, { signal });

      return readResponse(
        response,
        decodeDiningHistory,
        'Failed to fetch dining reservation history'
      );
    },
    queryKey: ['dining-reservations-history', status, userId, sessionId],
  });
};

/**
 * Hook to fetch a single dining reservation by ID
 */
export const useDiningReservationById = (
  reservationId: string,
  options: ConfirmationDetailOptions = {}
) => {
  const queryClient = useQueryClient();
  return useQuery({
    enabled: !!reservationId && options.enabled !== false,
    ...(options.mode === 'confirmation' ? { retry: false } : {}),
    queryFn: async context => {
      const decode = decodeDiningDetail(reservationId);
      if (options.mode === 'confirmation') {
        const { signal } = context;
        return fetchConfirmationDetail({
          decode,
          signal,
          url: `/api/dining-reservations/${reservationId}`,
          loadError: 'Failed to load reservation',
          notFoundError: 'Reservation not found',
          onUnavailable: () => {
            queryClient.setQueryData(
              ['dining-reservation', reservationId],
              null
            );
          },
        });
      }

      const response = await fetch(`/api/dining-reservations/${reservationId}`);
      return readResponse(
        response,
        decode,
        'Failed to fetch dining reservation'
      );
    },
    queryKey: ['dining-reservation', reservationId],
  });
};

/**
 * Hook to cancel a dining reservation
 */
export const useCancelDiningReservation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      reservationId: string
    ): Promise<ApiResponse<PopulatedDiningReservation>> => {
      const response = await fetch(
        `/api/dining-reservations/${reservationId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cancel dining reservation');
      }

      return response.json();
    },
    onSuccess: (_, reservationId) => {
      queryClient.invalidateQueries({
        queryKey: ['dining-reservation', reservationId],
      });
      queryClient.invalidateQueries({
        queryKey: ['dining-reservations-history'],
      });
      queryClient.invalidateQueries({ queryKey: ['dining-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['dining-availability'] });
    },
  });
};

/**
 * Hook to check dining availability for a specific date and optional time
 */
export const useDiningAvailability = ({
  diningId,
  date,
  time,
}: {
  diningId: string;
  date?: string;
  time?: string;
}) => {
  return useQuery({
    enabled: !!diningId && !!date,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (date) params.append('date', date);
      if (time) params.append('time', time);

      const response = await fetch(
        `/api/dining/${diningId}/availability?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch dining availability');
      }

      const body: unknown = await response.json().catch(() => undefined);
      const result = diningDayAvailabilityResponseSchema.safeParse(body);
      if (
        !result.success ||
        result.data.data.diningId.toLowerCase() !== diningId.toLowerCase() ||
        result.data.data.date !== date ||
        result.data.data.time !== (time || null)
      ) {
        throw new Error('Failed to fetch dining availability');
      }

      return result.data.data;
    },
    queryKey: ['dining-availability', diningId, date, time],
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
};
