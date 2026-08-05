'use client';
import { CalendarDays, ClipboardCheck, CreditCard, Mail } from 'lucide-react';

const STEPS = [
  {
    description:
      'Choose your arrival and departure dates and number of guests.',
    icon: CalendarDays,
    id: 1,
    title: 'Select Dates & Guests',
  },
  {
    description: 'Add any extras and confirm your booking details.',
    icon: ClipboardCheck,
    id: 2,
    title: 'Review Your Details',
  },
  {
    description: 'Pay securely via Stripe — your data is always protected.',
    icon: CreditCard,
    id: 3,
    title: 'Secure Payment',
  },
  {
    description: "You'll receive a confirmation email with all the details.",
    icon: Mail,
    id: 4,
    title: 'Instant Confirmation',
  },
];

export default function CabinBookingSteps() {
  return (
    <div>
      <h2 className='mb-4 text-xl font-semibold'>How Booking Works</h2>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {STEPS.map(({ description, icon: Icon, id, title }) => (
          <div
            key={id}
            className='flex flex-col items-center gap-3 p-4 text-center'
          >
            <div className='relative'>
              <div className='flex h-12 w-12 items-center justify-center rounded-full bg-primary-100'>
                <Icon className='text-primary' size={22} />
              </div>
              <span className='absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-white'>
                {id}
              </span>
            </div>
            <div>
              <p className='text-sm font-semibold'>{title}</p>
              <p className='mt-1 text-xs text-foreground-500'>{description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
