import { useAuth } from '@clerk/nextjs';
import { useLayoutEffect, useRef, useState } from 'react';
import { CreateRejectedError } from '@/lib/validations/mutation-response';

const unconfirmed =
  'We could not confirm whether this request was saved. Booking history shows your current reservations but cannot identify this request.';
export const missingCreatedDetail =
  'Your request was saved, but its details are unavailable. Check your bookings.';

export type CreateRecovery =
  { kind: 'confirmation'; href: string } | { kind: 'history'; notice: string };

/** One submitted create per mounted form until the server confirms rejection. */
export function useCreateAttempt(listingId: string) {
  const { isSignedIn, userId, sessionId } = useAuth();
  const active = useRef<symbol | null>(null);
  const [state, setState] = useState<{
    recovery: CreateRecovery | null;
  } | null>(null);
  useLayoutEffect(() => {
    setState(null);
    return () => {
      active.current = null;
    };
  }, [userId, sessionId, listingId, isSignedIn]);

  function begin() {
    if (active.current || !userId || !sessionId || !isSignedIn) return;
    const token = Symbol();
    active.current = token;
    setState({ recovery: null });
    let confirmed = false;
    const current = () => active.current === token;
    return {
      current,
      confirmed(href: string) {
        if (!current()) return;
        confirmed = true;
        setState({ recovery: { kind: 'confirmation', href } });
      },
      missingDetail() {
        if (current())
          setState({
            recovery: { kind: 'history', notice: missingCreatedDetail },
          });
      },
      failed(error: unknown) {
        if (!current()) return;
        if (confirmed)
          return {
            title: 'Request saved',
            description: 'Open your confirmation to continue.',
            color: 'warning' as const,
          };
        if (error instanceof CreateRejectedError) {
          active.current = null;
          setState(null);
          return {
            title: 'Request declined',
            description: error.message,
            color: 'danger' as const,
          };
        }
        setState({ recovery: { kind: 'history', notice: unconfirmed } });
        return {
          title: 'Request unconfirmed',
          description: unconfirmed,
          color: 'warning' as const,
        };
      },
    };
  }
  return { begin, blocked: state !== null, recovery: state?.recovery ?? null };
}
