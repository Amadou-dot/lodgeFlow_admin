import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ApiResponse } from '@/types';

interface PaymentStatusData {
  isPaid: boolean;
  depositPaid: boolean;
  depositAmount: number;
  totalPrice: number;
  paidAt?: Date;
  stripeSessionId?: string;
  refundAmount?: number;
  refundedAt?: Date;
}

/**
 * Hook to create a Stripe Checkout session for a booking
 */
export const useCreateCheckoutSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookingId: string): Promise<{ url: string }> => {
      const response = await fetch('/api/payments/create-checkout', {
        body: JSON.stringify({ bookingId }),
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-status'] });
      queryClient.invalidateQueries({ queryKey: ['bookings-history'] });
    },
  });
};

/**
 * Hook to fetch payment status for a booking
 */
export const usePaymentStatus = (bookingId: string) => {
  return useQuery({
    enabled: !!bookingId,
    queryFn: async (): Promise<PaymentStatusData | null> => {
      const response = await fetch(`/api/payments/${bookingId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch payment status');
      }

      const data: ApiResponse<PaymentStatusData> = await response.json();
      return data.data || null;
    },
    queryKey: ['payment-status', bookingId],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};
