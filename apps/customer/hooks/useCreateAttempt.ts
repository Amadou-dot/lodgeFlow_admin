import { useAuth } from '@clerk/nextjs';
import { useLayoutEffect, useRef, useState } from 'react';
import { CreateRejectedError } from '@/lib/validations/mutation-response';

const unconfirmed =
  'We could not confirm whether your request was saved. Check your bookings before making another request.';
export const missingCreatedDetail =
  'Your request was saved, but its details are unavailable. Check your bookings.';

/** One submitted create per mounted form until the server confirms rejection. */
export function useCreateAttempt(listingId: string) {
  const { isSignedIn, userId, sessionId } = useAuth();
  const active = useRef<symbol | null>(null);
  const [state, setState] = useState<{ notice?: string } | null>(null);
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
    setState({});
    const current = () => active.current === token;
    return {
      current,
      missingDetail() {
        if (current()) setState({ notice: missingCreatedDetail });
      },
      failed(error: unknown) {
        if (!current()) return;
        if (error instanceof CreateRejectedError) {
          active.current = null;
          setState(null);
          return {
            title: 'Request declined',
            description: error.message,
            color: 'danger' as const,
          };
        }
        setState({ notice: unconfirmed });
        return {
          title: 'Request unconfirmed',
          description: unconfirmed,
          color: 'warning' as const,
        };
      },
    };
  }
  return { begin, blocked: state !== null, notice: state?.notice };
}
