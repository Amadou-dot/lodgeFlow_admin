'use client';
import { openReservationCheckout } from '@/lib/open-reservation-checkout';
import { useLayoutEffect, useState } from 'react';
import { useCustomerWriteScope } from '@/hooks/useCustomerWriteScope';
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
  const canPay = !isPaid && ['pending', 'confirmed'].includes(status);
  const resource = kind + ':' + id;
  const { actorKey, capture } = useCustomerWriteScope(canPay ? [resource] : []);
  const [state, setState] = useState<
    { kind: 'idle' } | { kind: 'busy' } | { kind: 'error'; message: string }
  >({ kind: 'idle' });
  useLayoutEffect(() => {
    setState({ kind: 'idle' });
  }, [actorKey, canPay, resource]);

  if (!canPay) return null;

  async function pay() {
    const isCurrent = capture(resource);
    if (!isCurrent()) return;
    setState({ kind: 'busy' });
    try {
      await openReservationCheckout({ kind, id, isCurrent });
    } catch (error) {
      if (!isCurrent()) return;
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
