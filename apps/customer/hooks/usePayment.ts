import { useMutation, useQueryClient } from '@tanstack/react-query';

import { readCheckoutResponse } from '@/lib/validations/checkout-response';
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

      return readCheckoutResponse({
        response,
        fallbackMessage: 'Failed to create checkout session',
      });
    },
    onSuccess: (_, bookingId) => {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['payment-status'] });
      queryClient.invalidateQueries({ queryKey: ['bookings-history'] });
    },
  });
};
