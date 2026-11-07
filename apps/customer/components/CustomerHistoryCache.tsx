'use client';

import { useAuth } from '@clerk/nextjs';
import { useQueryClient, type Query } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';

const historyKeys = new Set([
  'bookings-history',
  'dining-reservations-history',
  'experience-bookings-history',
]);

/** Remains mounted during navigation so signing out also clears hidden history. */
export function CustomerHistoryCache({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId, sessionId } = useAuth();
  const client = useQueryClient();

  useEffect(() => {
    const obsolete = ({ queryKey }: Query) =>
      typeof queryKey[0] === 'string' &&
      historyKeys.has(queryKey[0]) &&
      (!isLoaded ||
        !isSignedIn ||
        queryKey[2] !== userId ||
        queryKey[3] !== sessionId);

    // Cancellation prevents an old response from restoring removed private data.
    void client.cancelQueries({ predicate: obsolete });
    client.removeQueries({ predicate: obsolete });
  }, [client, isLoaded, isSignedIn, userId, sessionId]);

  return <>{children}</>;
}
