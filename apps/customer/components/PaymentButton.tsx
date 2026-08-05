'use client';

import { Button } from '@heroui/button';
import { addToast } from '@heroui/toast';
import { CreditCard } from 'lucide-react';

import { useCreateCheckoutSession } from '@/hooks/usePayment';

interface PaymentButtonProps {
  bookingId: string;
  amount: number;
  isDeposit?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function PaymentButton({
  bookingId,
  amount,
  isDeposit = false,
  size = 'md',
  className,
}: PaymentButtonProps) {
  const createCheckout = useCreateCheckoutSession();

  const handlePayment = async () => {
    try {
      const { url } = await createCheckout.mutateAsync(bookingId);
      window.location.href = url;
    } catch (error) {
      addToast({
        title: 'Payment Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to initiate payment. Please try again.',
        color: 'danger',
      });
    }
  };

  return (
    <Button
      className={className}
      color='success'
      isLoading={createCheckout.isPending}
      size={size}
      startContent={
        !createCheckout.isPending && <CreditCard className='w-4 h-4' />
      }
      onPress={handlePayment}
    >
      {isDeposit ? `Pay Deposit ($${amount})` : `Pay Now ($${amount})`}
    </Button>
  );
}
