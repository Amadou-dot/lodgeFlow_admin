import { useEffect, useState } from 'react';
import type { ApiResponse } from '@/types';

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

/** Preserve confirmation-page errors while sharing the existing detail cache. */
export async function fetchConfirmationDetail<T>({
  url,
  loadError,
  notFoundError,
  statusError = notFoundError,
  onUnavailable,
}: {
  url: string;
  loadError: string;
  notFoundError: string;
  statusError?: string;
  onUnavailable: () => void;
}): Promise<T | null> {
  let response: Response;
  let result: ApiResponse<T>;
  try {
    response = await fetch(url);
  } catch {
    throw new Error(loadError);
  }
  try {
    try {
      result = await response.json();
    } catch {
      throw new ConfirmationRequestError({
        message: loadError,
        status: response.status,
      });
    }
    if (!response.ok)
      throw new ConfirmationRequestError({
        message: result.error || statusError,
        status: response.status,
      });
    if (!result.success)
      throw new ConfirmationRequestError({
        message: result.error || notFoundError,
        status: response.status,
      });
  } catch (error) {
    // Clear denied data immediately before rejection so later transient retries
    // and remounts cannot restore it, while preserving the server's error.
    if (isUnavailableConfirmationError(error)) onUnavailable();
    throw error;
  }
  return result.data || null;
}
