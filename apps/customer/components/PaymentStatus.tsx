'use client';

import { Chip } from '@heroui/chip';

interface PaymentStatusProps {
  isPaid: boolean;
  depositPaid?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function PaymentStatus({
  isPaid,
  depositPaid = false,
  size = 'sm',
}: PaymentStatusProps) {
  if (isPaid) {
    return (
      <Chip color='success' size={size} variant='flat'>
        Paid
      </Chip>
    );
  }

  if (depositPaid) {
    return (
      <Chip color='primary' size={size} variant='flat'>
        Deposit Paid
      </Chip>
    );
  }

  return (
    <Chip color='warning' size={size} variant='flat'>
      Payment Pending
    </Chip>
  );
}
