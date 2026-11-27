'use client';

/**
 * Booking data fetching hooks
 *
 * Data Fetching Strategy:
 * -----------------------
 * This application uses a dual-library approach for data fetching:
 *
 * 1. SWR (for reads):
 *    - useBookings, useBooking, useBookingByEmail
 *    - Handles automatic caching, revalidation, and request deduplication
 *    - Provides keepPreviousData for smooth UI transitions
 *    - Revalidates on window focus (configurable)
 *
 * 2. TanStack Query (for mutations):
 *    - useCreateBooking, useUpdateBooking, useDeleteBooking, etc.
 *    - Handles mutation state (isPending, isError, isSuccess)
 *    - Provides automatic cache invalidation after mutations
 *    - Enables optimistic updates when needed
 *
 * Successful mutations invalidate related React Query caches and revalidate
 * mounted SWR booking reads in the current provider.
 *
 * @see hooks/useCabins.ts - Same pattern for cabin operations
 * @see hooks/useCustomers.ts - Same pattern for customer operations
 */

import { STAFF_TEST_UI, SWR_CONFIG } from '@/lib/config';
import { resourceReadKey } from '@/hooks/resourceReadKey';
import type { BookingsFilters } from '@/types';
import type { AdminBooking, BookingByEmail } from '@/types/booking-read';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import { z } from 'zod';
import { StaffRequestRejected } from '@/lib/validations/staff-request-rejected';
import {
  bookingListResponse,
  bookingDetailResponse,
  bookingCollectionWriteResponse,
  bookingByEmailResponse,
  bookingDeleteResponse,
} from '@/lib/validations/booking-json';
import type { CreateBookingInput, UpdateBookingInput } from '@/types/api';
import { addToast } from '@heroui/toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import useSWR, { useSWRConfig } from 'swr';

const isBookingReadKey = resourceReadKey('/api/bookings');

const useRefreshBookingCaches = () => {
  const queryClient = useQueryClient();
  const { mutate } = useSWRConfig();

  return () => {
    queryClient.invalidateQueries({ queryKey: ['bookings'] });
    queryClient.invalidateQueries({ queryKey: ['activities'] });
    queryClient.invalidateQueries({ queryKey: ['overview'] });
    queryClient.invalidateQueries({ queryKey: ['booking-analytics'] });
    queryClient.invalidateQueries({ queryKey: ['booking-stats'] });
    queryClient.invalidateQueries({ queryKey: ['sales'] });
    queryClient.invalidateQueries({ queryKey: ['durations'] });
    // A read refresh failure must not turn the successful write into a retry.
    void mutate(isBookingReadKey).catch(() => {});
  };
};

const errorBody = z.object({
  success: z.literal(false).optional(),
  error: z.string().min(1),
});
function matches<T>(body: unknown, schema: z.ZodType<T>): body is T {
  return schema.safeParse(body).success;
}
async function readResponse<T>({
  response,
  schema,
  fallback,
  showHttpError = true,
}: {
  response: Response;
  schema: z.ZodType<T>;
  fallback: string;
  showHttpError?: boolean;
}): Promise<T> {
  if (!response.ok && !showHttpError) throw new Error(fallback);
  const body: unknown = await response.json().catch(() => undefined);
  if (response.ok && matches(body, schema)) return body;
  const failure = errorBody.safeParse(body);
  if (
    !response.ok &&
    failure.success &&
    [400, 401, 403, 404, 409].includes(response.status)
  )
    throw new StaffRequestRejected(failure.data.error, response.status);
  throw new Error(failure.success ? failure.data.error : fallback);
}

const fetcher = async (url: string) => {
  const {
    data: bookings,
    pagination,
    _clerkWarning,
  } = await readResponse({
    response: await fetch(url),
    schema: bookingListResponse,
    fallback: 'Failed to fetch bookings',
    showHttpError: false,
  });
  return { bookings, pagination, _clerkWarning };
};

async function readCollectionWrite(
  response: Response,
  fallback: string
): Promise<AdminBooking> {
  const result = await readResponse({
    response,
    schema: bookingCollectionWriteResponse,
    fallback,
  });
  return result.success ? result.data : result;
}

// Fetch bookings with filters and pagination using SWR
export const useBookings = (filters: BookingsFilters = {}) => {
  const params = new URLSearchParams();

  if (filters.page) params.append('page', filters.page.toString());
  if (filters.limit) params.append('limit', filters.limit.toString());
  if (filters.status) params.append('status', filters.status);
  if (filters.search) params.append('search', filters.search);
  if (filters.sortBy) params.append('sortBy', filters.sortBy);
  if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

  const { data, error, isLoading, mutate } = useSWR<
    Awaited<ReturnType<typeof fetcher>>
  >(`/api/bookings?${params.toString()}`, fetcher, {
    keepPreviousData: SWR_CONFIG.KEEP_PREVIOUS_DATA,
    revalidateOnFocus: SWR_CONFIG.REVALIDATE_ON_FOCUS,
    dedupingInterval: SWR_CONFIG.DEDUPING_INTERVAL,
  });

  return {
    data,
    error,
    isLoading,
    mutate, // For manual revalidation
  };
};

async function readBookingDetail(response: Response, url: string) {
  const result = await readResponse({
    response,
    schema: bookingDetailResponse,
    fallback: 'Failed to fetch booking',
    showHttpError: false,
  });
  if (
    result.data._id.toLowerCase() !==
    url.slice('/api/bookings/'.length).toLowerCase()
  )
    throw new Error('Failed to fetch booking');
  return result.data;
}

// Fetch a single booking by ID
export const useBooking = (id: string) => {
  const { data, error, isLoading, mutate } = useSWR<AdminBooking>(
    id ? `/api/bookings/${id}` : null,
    async (url: string) => readBookingDetail(await fetch(url), url),
    {
      keepPreviousData: SWR_CONFIG.KEEP_PREVIOUS_DATA,
      revalidateOnFocus: SWR_CONFIG.REVALIDATE_ON_FOCUS,
      dedupingInterval: SWR_CONFIG.DEDUPING_INTERVAL,
    }
  );

  return {
    data,
    error,
    isLoading,
    mutate,
  };
};

// Fetch a single booking by email
export const useBookingByEmail = (email: string) => {
  const { data, error, isLoading, mutate } = useSWR<BookingByEmail>(
    email ? `/api/bookings/by-email?email=${encodeURIComponent(email)}` : null,
    async (url: string) => {
      const result = await readResponse({
        response: await fetch(url),
        schema: bookingByEmailResponse,
        fallback: 'Failed to fetch booking',
        showHttpError: false,
      });
      return result.data;
    },
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );

  return {
    data,
    error,
    isLoading,
    mutate,
  };
};

// Create a new booking
export const useCreateBooking = () => {
  const refreshBookingCaches = useRefreshBookingCaches();

  return useMutation({
    mutationFn: async (
      bookingData: CreateBookingInput
    ): Promise<AdminBooking> => {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData),
      });

      return readCollectionWrite(response, 'Failed to create booking');
    },
    onSuccess: refreshBookingCaches,
  });
};

type Receipt = NonNullable<AdminBooking['payments']>[number];
type StaffPayment = {
  bookingId: string;
  paymentMethod: Receipt['method'];
  amountPaid: number;
  notes?: string;
};
type ReceiptAttempt = Pick<Receipt, 'id' | 'amount' | 'method'> & {
  dialogId: symbol;
  bookingId: string;
  notes?: string;
  onReconciled: () => void;
  phase: 'unconfirmed' | 'correctable' | 'correction';
};

function confirmsReceipt(booking: AdminBooking, attempt: ReceiptAttempt) {
  return (
    booking._id === attempt.bookingId.toLowerCase() &&
    booking.payments?.some(
      receipt =>
        receipt.id === attempt.id &&
        receipt.amount === attempt.amount &&
        receipt.method === attempt.method
    )
  );
}

export const useRecordPayment = ({
  booking,
  dialogId,
  onReconciled,
}: {
  booking: AdminBooking;
  dialogId: symbol | null;
  onReconciled: () => void;
}) => {
  const { isLoaded, isSignedIn, userId, sessionId } = useAuth();
  const owner = useMemo(
    () =>
      dialogId &&
      (STAFF_TEST_UI || (isLoaded && isSignedIn && userId && sessionId))
        ? { userId, sessionId, bookingId: booking._id, dialogId }
        : null,
    [isLoaded, isSignedIn, userId, sessionId, booking._id, dialogId]
  );
  const activeOwner = useRef<typeof owner>(null);
  useLayoutEffect(() => {
    activeOwner.current = owner;
    return () => {
      activeOwner.current = null;
    };
  }, [owner]);

  const pending = useRef<ReceiptAttempt | null>(null);
  useLayoutEffect(
    () => () => {
      pending.current = null;
    },
    [isLoaded, isSignedIn, userId, sessionId, booking._id]
  );
  const refreshBookingCaches = useRefreshBookingCaches();
  const { mutate } = useSWRConfig();

  const mutation = useMutation({
    // TanStack captures meta when enqueued, even if the first dispatch waits for reconnect.
    meta: { owner },
    retry: false,
    mutationFn: async (
      data: StaffPayment | { retryAttempt: ReceiptAttempt },
      context
    ): Promise<AdminBooking> => {
      if (!activeOwner.current || activeOwner.current !== context.meta?.owner)
        throw new Error('This payment dialog is no longer active.');
      const unresolved = pending.current;
      let attempt = unresolved;
      if ('retryAttempt' in data) {
        if (
          !attempt ||
          !dialogId ||
          attempt !== data.retryAttempt ||
          attempt.bookingId !== booking._id
        )
          throw new Error('No previous payment is awaiting confirmation.');
      } else if (attempt && attempt.phase !== 'correctable') {
        if (
          attempt.dialogId !== dialogId ||
          attempt.bookingId !== data.bookingId ||
          attempt.amount !== data.amountPaid ||
          attempt.method !== data.paymentMethod ||
          attempt.notes !== data.notes
        ) {
          throw new Error(
            'Retry the original payment or refresh this booking to confirm the previous payment.'
          );
        }
      } else {
        if (!dialogId || booking._id !== data.bookingId)
          throw new Error('Open the payment dialog for this booking.');
        attempt = {
          bookingId: data.bookingId,
          id: unresolved?.id ?? crypto.randomUUID(),
          amount: data.amountPaid,
          method: data.paymentMethod,
          notes: data.notes,
          dialogId,
          onReconciled,
          phase: unresolved ? 'correction' : 'unconfirmed',
        };
      }

      // A late failure from a superseded request must not release its successor.
      attempt = { ...attempt };
      pending.current = attempt;
      const url = `/api/bookings/${attempt.bookingId}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordPayment: {
            paymentMethod: attempt.method,
            amountPaid: attempt.amount,
            notes: attempt.notes,
            receiptId: attempt.id,
          },
        }),
      });

      let saved: AdminBooking;
      try {
        ({ data: saved } = await readResponse({
          response,
          schema: bookingDetailResponse,
          fallback: 'Failed to record payment',
        }));
      } catch (error) {
        if (
          !(error instanceof StaffRequestRejected) ||
          pending.current !== attempt
        )
          throw error;
        if (!unresolved) {
          pending.current = null;
        } else if ([400, 409].includes(error.status)) {
          const current = await fetch(url, { cache: 'no-store' })
            .then(response => readBookingDetail(response, url))
            .catch(() => undefined);
          if (current && pending.current === attempt) {
            void mutate(url).catch(() => {});
            if (confirmsReceipt(current, attempt)) {
              pending.current = null;
              return current;
            }
            const recorded = current.payments?.find(
              receipt => receipt.id === attempt.id
            );
            if (!recorded) {
              // Keep the ID even when a fresh ledger permits a corrected draft.
              pending.current = { ...attempt, phase: 'correctable' };
            } else if (attempt.phase === 'correction') {
              pending.current = null;
              throw new Error(
                `This receipt already records a ${recorded.method} payment of ${recorded.amount}. Review the updated balance.`
              );
            }
          }
        }
        throw error;
      }
      if (!confirmsReceipt(saved, attempt))
        throw new Error('Failed to record payment');
      if (pending.current === attempt) pending.current = null;
      return saved;
    },
    onSuccess: refreshBookingCaches,
  });

  const { isError, reset } = mutation;
  useEffect(() => {
    const attempt = pending.current;
    if (isError && attempt && confirmsReceipt(booking, attempt)) {
      pending.current = null;
      reset();
      attempt.onReconciled();
      refreshBookingCaches();
    }
  }, [booking, isError, reset, refreshBookingCaches]);

  // A reduced balance can invalidate even the current dialog's original amount.
  // Explicit replay still sends the saved amount, note and ID.
  const previous =
    isError && pending.current?.phase !== 'correctable'
      ? pending.current
      : null;
  return {
    ...mutation,
    previousPayment: previous
      ? {
          amount: previous.amount,
          method: previous.method,
          notes: previous.notes,
        }
      : undefined,
    retryPreviousPayment: async () => {
      if (!previous)
        throw new Error('No previous payment is awaiting confirmation.');
      const saved = await mutation.mutateAsync({ retryAttempt: previous });
      if (activeOwner.current === owner) previous.onReconciled();
      return saved;
    },
  };
};

// Update an existing booking
export const useUpdateBooking = () => {
  const refreshBookingCaches = useRefreshBookingCaches();

  return useMutation({
    mutationFn: async (
      updateData: UpdateBookingInput
    ): Promise<AdminBooking> => {
      const response = await fetch('/api/bookings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      const booking = await readCollectionWrite(
        response,
        'Failed to update booking'
      );
      if (
        booking._id !== updateData._id.toLowerCase() ||
        (updateData.status !== undefined &&
          booking.status !== updateData.status)
      )
        throw new Error('Failed to update booking');
      return booking;
    },
    onSuccess: () => {
      refreshBookingCaches();
      addToast({
        title: 'Booking updated',
        description: 'The booking has been updated successfully.',
        color: 'success',
      });
    },
    onError: (error: Error) => {
      addToast({
        title: 'Update failed',
        description: error.message,
        color: 'danger',
      });
    },
  });
};

// Delete a booking
export const useDeleteBooking = () => {
  const refreshBookingCaches = useRefreshBookingCaches();

  return useMutation({
    mutationFn: async (bookingId: string): Promise<void> => {
      const response = await fetch(`/api/bookings?id=${bookingId}`, {
        method: 'DELETE',
      });

      await readResponse({
        response,
        schema: bookingDeleteResponse,
        fallback: 'Failed to delete booking',
        showHttpError: false,
      });
    },
    onSuccess: refreshBookingCaches,
  });
};

function useBookingTransition({
  status,
  fallback,
}: {
  status: 'checked-in' | 'checked-out' | 'confirmed';
  fallback: string;
}) {
  const refreshBookingCaches = useRefreshBookingCaches();
  return useMutation({
    mutationFn: async (bookingId: string): Promise<AdminBooking> => {
      const response = await fetch('/api/bookings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _id: bookingId, status }),
      });
      const booking = await readCollectionWrite(response, fallback);
      if (booking._id !== bookingId.toLowerCase() || booking.status !== status)
        throw new Error(fallback);
      return booking;
    },
    onSuccess: refreshBookingCaches,
  });
}
export const useCheckInBooking = () =>
  useBookingTransition({
    status: 'checked-in',
    fallback: 'Failed to check in booking',
  });
export const useCheckOutBooking = () =>
  useBookingTransition({
    status: 'checked-out',
    fallback: 'Failed to check out booking',
  });
export const useConfirmBooking = () =>
  useBookingTransition({
    status: 'confirmed',
    fallback: 'Failed to confirm booking',
  });
