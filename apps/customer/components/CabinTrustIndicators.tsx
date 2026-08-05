'use client';
import type { CancellationPolicy } from '@/types';
import { BadgeCheck, CalendarX, Headphones, LockKeyhole } from 'lucide-react';

interface Props {
  cancellationPolicy: CancellationPolicy;
}

const CANCELLATION_TEXT: Record<CancellationPolicy, string> = {
  flexible: 'Free cancellation up to 24 hours before check-in',
  moderate: 'Free cancellation up to 5 days before check-in',
  strict: '50% refund up to 7 days before check-in',
};

export default function CabinTrustIndicators({ cancellationPolicy }: Props) {
  const indicators = [
    {
      description: '256-bit SSL encrypted payments',
      icon: LockKeyhole,
      id: 'secure',
      title: 'Secure Booking',
    },
    {
      description: 'Identity verified by LodgeFlow',
      icon: BadgeCheck,
      id: 'verified',
      title: 'Verified Host',
    },
    {
      description:
        CANCELLATION_TEXT[cancellationPolicy] ??
        'Contact us for cancellation details',
      icon: CalendarX,
      id: 'cancellation',
      title: 'Cancellation Policy',
    },
    {
      description: "We're here if anything goes wrong",
      icon: Headphones,
      id: 'support',
      title: '24/7 Support',
    },
  ];

  return (
    <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
      {indicators.map(({ description, icon: Icon, id, title }) => (
        <div
          key={id}
          className='flex items-start gap-3 rounded-xl border border-divider bg-content1 p-3'
        >
          <Icon className='mt-0.5 shrink-0 text-primary' size={20} />
          <div>
            <p className='text-sm font-semibold'>{title}</p>
            <p className='mt-0.5 text-xs text-foreground-500'>{description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
