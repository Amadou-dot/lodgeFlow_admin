import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { ApiResponse } from '@/types';
import type { CreateCheckoutInput } from '@/lib/validations/checkout';

/**
 * Hook to create a Stripe Checkout session for a booking
 */
export const useCreateCheckoutSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookingId: string): Promise<{ url: string }> => {
      const body: CreateCheckoutInput = { bookingId };
      const response = await fetch('/api/payments/create-checkout', {
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create checkout session');
      }

      const data: ApiResponse<{ url: string }> = await response.json();
      return data.data!;
    },
    onSuccess: (_, bookingId) => {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['payment-status'] });
      queryClient.invalidateQueries({ queryKey: ['bookings-history'] });
    },
  });
};
