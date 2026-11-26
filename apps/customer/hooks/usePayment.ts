import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCustomerWriteScope } from './useCustomerWriteScope';

import { readCheckoutResponse } from '@/lib/validations/checkout-response';
import type { CreateCheckoutInput } from '@/lib/validations/checkout';

/**
 * Hook to create a Stripe Checkout session for a booking
 */
export const useCreateCheckoutSession = (bookingId: string) => {
  const scope = useCustomerWriteScope([bookingId]);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    meta: scope.meta,
    mutationFn: async (
      bookingId: string,
      context
    ): Promise<{ url: string }> => {
      scope.customerIdFor(context, bookingId);
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

  return {
    ...mutation,
    actorKey: scope.actorKey,
    capture: () => scope.capture(bookingId),
  };
};
