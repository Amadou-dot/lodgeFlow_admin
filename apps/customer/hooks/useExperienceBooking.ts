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
  return useQuery({
    queryFn: async (): Promise<PopulatedExperienceBooking[]> => {
      const url = status
        ? `/api/experience-bookings/history?status=${status}`
        : '/api/experience-bookings/history';

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch experience booking history');
      }

      const data: ApiResponse<PopulatedExperienceBooking[]> =
        await response.json();
      return data.data || [];
    },
    queryKey: ['experience-bookings-history', status],
  });
};

/**
 * Hook to fetch a single experience booking by ID
 */
export const useExperienceBookingById = (bookingId: string) => {
  return useQuery({
    enabled: !!bookingId,
    queryFn: async (): Promise<PopulatedExperienceBooking | null> => {
      const response = await fetch(`/api/experience-bookings/${bookingId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch experience booking');
      }

      const data: ApiResponse<PopulatedExperienceBooking> =
        await response.json();
      return data.data || null;
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
    mutationFn: async (bookingId: string): Promise<ApiResponse<null>> => {
      const response = await fetch(`/api/experience-bookings/${bookingId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cancel experience booking');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['experience-bookings-history'],
      });
      queryClient.invalidateQueries({ queryKey: ['experience-bookings'] });
    },
  });
};

interface ExperienceAvailability {
  experienceId: string;
  date?: string;
  spotsRemaining?: number;
  maxParticipants: number | null;
  isAvailable?: boolean;
  fullyBookedDates?: string[];
  availableDays?: string[];
}

/**
 * Hook to check experience availability for a specific date
 */
export const useExperienceAvailability = (
  experienceId: string,
  date?: string
) => {
  return useQuery({
    enabled: !!experienceId,
    queryFn: async (): Promise<ExperienceAvailability | null> => {
      const params = date ? `?date=${date}` : '';
      const response = await fetch(
        `/api/experiences/${experienceId}/availability${params}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch experience availability');
      }

      const data: ApiResponse<ExperienceAvailability> = await response.json();
      return data.data || null;
    },
    queryKey: ['experience-availability', experienceId, date],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};
