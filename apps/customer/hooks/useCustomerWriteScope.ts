import { useAuth } from '@clerk/nextjs';
import type { MutationFunctionContext } from '@tanstack/react-query';
import { useLayoutEffect, useRef } from 'react';

export class ObsoleteCustomerWriteError extends Error {
  constructor() {
    super('This booking action is no longer open.');
    this.name = 'ObsoleteCustomerWriteError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** TanStack snapshots meta on enqueue, even if mutationFn first runs after reconnect. */
export function useCustomerWriteScope(resourceIds: readonly string[]) {
  const { isLoaded, isSignedIn, userId, sessionId } = useAuth();
  const active = useRef(new Map<string, symbol>());
  const resourceTokens = new Map<string, symbol>();

  useLayoutEffect(
    () => () => {
      active.current = new Map();
    },
    [isLoaded, isSignedIn, userId, sessionId]
  );
  useLayoutEffect(() => {
    if (isLoaded && isSignedIn && userId && sessionId) {
      for (const id of resourceIds) {
        const key = id.toLowerCase();
        resourceTokens.set(key, active.current.get(key) ?? Symbol());
      }
    }
    active.current = resourceTokens;
  });

  function customerIdFor(context: MutationFunctionContext, resourceId: string) {
    const original = context.meta?.resourceTokens;
    const key = resourceId.toLowerCase();
    const token = active.current.get(key);
    if (
      !userId ||
      !token ||
      !(original instanceof Map) ||
      original.get(key) !== token
    )
      throw new ObsoleteCustomerWriteError();
    return userId;
  }
  return { meta: { resourceTokens }, customerIdFor };
}
