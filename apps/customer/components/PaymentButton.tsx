'use client';

import { Button } from '@heroui/button';
import { addToast } from '@heroui/toast';
import { CreditCard } from 'lucide-react';
import { useLayoutEffect } from 'react';

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
  const { actorKey, capture, isPending, mutateAsync, reset } =
    useCreateCheckoutSession(bookingId);
  useLayoutEffect(() => {
    reset();
  }, [actorKey, bookingId, reset]);

  const handlePayment = async () => {
    const isCurrent = capture();
    if (!isCurrent()) return;
    try {
      const { url } = await mutateAsync(bookingId);
      if (isCurrent()) window.location.href = url;
    } catch (error) {
      if (!isCurrent()) return;
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
      isLoading={isPending}
      size={size}
      startContent={!isPending && <CreditCard className='w-4 h-4' />}
      onPress={handlePayment}
    >
      {isDeposit ? `Pay Deposit ($${amount})` : `Pay Now ($${amount})`}
    </Button>
  );
}
