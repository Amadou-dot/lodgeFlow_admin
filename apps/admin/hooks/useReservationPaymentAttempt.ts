import { useRef, useState } from 'react';
import type { ReservationTransaction } from '@/lib/validations/reservation-operations-json';

export type PaymentDraft = Pick<
  ReservationTransaction,
  'type' | 'method' | 'reference'
> & { amount: string };

export type PaymentAttempt = {
  transaction: ReservationTransaction;
  body: string;
  draft: PaymentDraft;
};

type ActionState =
  | { kind: 'idle' | 'busy' }
  | { kind: 'error'; message: string }
  | { kind: 'uncertain'; attempt: PaymentAttempt; message: string };

// The detail owns this state across denied reads. The form owns its editable draft.
export function useReservationPaymentAttempt() {
  const [state, setState] = useState<ActionState>({ kind: 'idle' });
  const request = useRef<PaymentAttempt>();
  const manualCorrection = useRef<PaymentAttempt>();
  const sending = useRef(false);
  return { state, setState, request, manualCorrection, sending };
}
