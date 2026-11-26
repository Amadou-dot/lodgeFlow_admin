import { useEffect, useState } from 'react';
import { z } from 'zod';

export interface ConfirmationDetailOptions {
  enabled?: boolean;
  mode?: 'detail' | 'confirmation';
}

/** Hide the previous resource as soon as the route's params promise changes. */
export function useConfirmationId(params: Promise<{ id: string }>) {
  const [resolved, setResolved] = useState<{
    params: Promise<{ id: string }>;
    id: string;
  }>();
  useEffect(() => {
    let current = true;
    params.then(({ id }) => {
      if (current) setResolved({ params, id });
    });
    return () => {
      current = false;
    };
  }, [params]);
  return resolved?.params === params ? resolved.id : '';
}

export class ConfirmationRequestError extends Error {
  readonly status: number;

  constructor({ message, status }: { message: string; status: number }) {
    super(message);
    this.name = 'ConfirmationRequestError';
    this.status = status;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function isUnavailableConfirmationError(error: unknown) {
  return (
    error instanceof ConfirmationRequestError &&
    (error.status === 401 || error.status === 403 || error.status === 404)
  );
}

const errorBody = z.object({
  success: z.unknown().optional(),
  error: z.string().optional(),
});

/** Preserve confirmation-page errors while sharing the existing detail cache. */
export async function fetchConfirmationDetail<T>({
  url,
  loadError,
  notFoundError,
  statusError = notFoundError,
  onUnavailable,
  decode,
  signal,
}: {
  url: string;
  loadError: string;
  notFoundError: string;
  statusError?: string;
  onUnavailable: () => void;
  signal: AbortSignal;
  decode: (value: unknown) => T | undefined;
}): Promise<T | null> {
  let response: Response;
  try {
    response = await fetch(url, { signal });
  } catch {
    throw new Error(loadError);
  }
  const body: unknown = await response.json().catch(() => undefined);
  if (response.ok) {
    const data = decode(body);
    if (data !== undefined) return data;
  }
  const failure = errorBody.safeParse(body);
  let message = loadError;
  if (failure.success) {
    if (!response.ok) message = failure.data.error || statusError;
    else if (failure.data.success === false)
      message = failure.data.error || notFoundError;
  }
  const error = new ConfirmationRequestError({
    message,
    status: response.status,
  });
  if (!signal.aborted && isUnavailableConfirmationError(error)) onUnavailable();
  throw error;
}
