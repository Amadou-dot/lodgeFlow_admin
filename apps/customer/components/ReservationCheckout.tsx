'use client';
import { openReservationCheckout } from '@/lib/open-reservation-checkout';
import { useState } from 'react';
export function ReservationCheckout({
  kind,
  id,
  isPaid,
  status,
}: {
  kind: 'dining' | 'experience';
  id: string;
  isPaid: boolean;
  status: string;
}) {
  const [state, setState] = useState<
    { kind: 'idle' } | { kind: 'busy' } | { kind: 'error'; message: string }
  >({ kind: 'idle' });
  if (isPaid || !['pending', 'confirmed'].includes(status)) return null;
  async function pay() {
    setState({ kind: 'busy' });
    try {
      await openReservationCheckout({ kind, id });
    } catch (error) {
      setState({
        kind: 'error',
        message:
          error instanceof Error ? error.message : 'Unable to start checkout',
      });
    }
  }
  return (
    <div className='space-y-2'>
      <button
        className='rounded bg-primary text-primary-foreground px-4 py-2 disabled:opacity-50'
        disabled={state.kind === 'busy'}
        onClick={() => void pay()}
      >
        {state.kind === 'busy'
          ? 'Opening checkout…'
          : 'Pay outstanding balance'}
      </button>
      {state.kind === 'error' && <p role='alert'>{state.message}</p>}
      <p className='text-sm'>
        Payment confirmation may take a moment. Refresh this page after paying.
      </p>
    </div>
  );
}
