import { useCallback, useEffect, useMemo, useState } from 'react';

type LoadState<T> =
  | { kind: 'loading'; data: T | undefined }
  | { kind: 'ready'; data: T }
  | { kind: 'error'; data: T | undefined; message: string };

// A refresh may keep useful data, but only within the same resource context.
export function useResourceLoad<T>({
  resourceKey,
  request,
}: {
  resourceKey: string;
  request: (signal: AbortSignal) => Promise<T>;
}) {
  const context = useMemo(
    () => ({
      active: true,
      sequence: 0,
      controller: undefined as AbortController | undefined,
    }),
    [resourceKey]
  );
  const [stored, setStored] = useState<{
    context: typeof context;
    state: LoadState<T>;
  }>({
    context,
    state: { kind: 'loading', data: undefined },
  });
  const reload = useCallback(async () => {
    if (!context.active) return;
    context.controller?.abort();
    const controller = new AbortController();
    context.controller = controller;
    const sequence = ++context.sequence;
    const current = () =>
      context.active &&
      !controller.signal.aborted &&
      sequence === context.sequence;
    setStored(previous => ({
      context,
      state: {
        kind: 'loading',
        data: previous.context === context ? previous.state.data : undefined,
      },
    }));
    try {
      const data = await request(controller.signal);
      if (current()) setStored({ context, state: { kind: 'ready', data } });
    } catch (error) {
      if (!current()) return;
      const message =
        error instanceof Error ? error.message : 'Unable to load data';
      setStored(previous => ({
        context,
        state: {
          kind: 'error',
          message,
          data: previous.context === context ? previous.state.data : undefined,
        },
      }));
      throw error;
    }
  }, [context, request]);
  useEffect(() => {
    context.active = true;
    void reload().catch(() => {});
    return () => {
      context.active = false;
      context.controller?.abort();
    };
  }, [context, reload]);
  const state: LoadState<T> =
    stored.context === context
      ? stored.state
      : { kind: 'loading', data: undefined };
  return { state, reload };
}
