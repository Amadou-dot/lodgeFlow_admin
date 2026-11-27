/** @jest-environment ./__tests__/setup/fetch-jsdom.cjs */
import { createElement, type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from '@tanstack/react-query';
import { SWRConfig } from 'swr';
import { addToast } from '@heroui/toast';
import { patchBookingSchema } from '@/lib/validations/booking';
import { bookingDetailResponse } from '@/lib/validations/booking-json';
import type { AdminBooking } from '@/types/booking-read';
import type { CreateBookingInput } from '@/types/api';
import {
  useBooking,
  useCheckInBooking,
  useCheckOutBooking,
  useConfirmBooking,
  useCreateBooking,
  useDeleteBooking,
  useRecordPayment,
  useUpdateBooking,
} from '@/hooks/useBookings';

jest.unmock('swr');
let mockStaff = {
  isLoaded: true,
  isSignedIn: true,
  userId: 'staff',
  sessionId: 'session',
};
jest.mock('@clerk/nextjs', () => ({ useAuth: () => mockStaff }));
const id = '507f1f77bcf86cd799439011';
const customer = { id: 'user_1', name: 'Unavailable guest', email: 'N/A' };
const row = {
  _id: id,
  id,
  customer,
  guest: customer,
  cabin: null,
  checkInDate: '2040-06-01T23:30:00.000Z',
  checkOutDate: '2040-06-03T23:30:00.000Z',
  numGuests: 2,
  numNights: 2,
  cabinPrice: 100,
  totalPrice: 100.125,
};
const dialogId = Symbol('payment dialog');
const create: CreateBookingInput = {
  customer: customer.id,
  cabin: id,
  numGuests: 2,
  checkInDate: row.checkInDate,
  checkOutDate: row.checkOutDate,
};
const update = { _id: id, observations: '' };
const payment = {
  bookingId: id,
  amountPaid: 10,
  paymentMethod: 'card' as const,
  notes: 'at desk',
};
const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
const originalFetch = global.fetch;
let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client }, children);
}
beforeEach(() => {
  mockStaff = {
    isLoaded: true,
    isSignedIn: true,
    userId: 'staff',
    sessionId: 'session',
  };
  jest.clearAllMocks();
  fetchMock.mockReset();
  global.fetch = fetchMock;
  client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
});
afterEach(() => {
  client.clear();
  global.fetch = originalFetch;
});
function hooks() {
  return {
    create: useCreateBooking(),
    update: useUpdateBooking(),
    remove: useDeleteBooking(),
    checkIn: useCheckInBooking(),
    checkOut: useCheckOutBooking(),
    confirm: useConfirmBooking(),
    payment: useRecordPayment({
      booking: row,
      dialogId,
      onReconciled: jest.fn(),
    }),
  };
}
function setup() {
  const invalidated = jest.spyOn(client, 'invalidateQueries');
  const { result } = renderHook(hooks, { wrapper });
  return { result, invalidated };
}
const related = [
  'bookings',
  'activities',
  'overview',
  'booking-analytics',
  'booking-stats',
  'sales',
  'durations',
];

test.each([
  { action: 'create', method: 'POST', body: create, status: 'unconfirmed' },
  { action: 'update', method: 'PUT', body: update, status: 'confirmed' },
  {
    action: 'checkIn',
    method: 'PUT',
    body: { _id: id, status: 'checked-in' },
    status: 'checked-in',
  },
  {
    action: 'checkOut',
    method: 'PUT',
    body: { _id: id, status: 'checked-out' },
    status: 'checked-out',
  },
  {
    action: 'confirm',
    method: 'PUT',
    body: { _id: id, status: 'confirmed' },
    status: 'confirmed',
  },
] as const)(
  '$action sends its request and refreshes only after a valid result',
  async ({ action, method, body, status }) => {
    const { result, invalidated } = setup();
    const submit = () =>
      action === 'create'
        ? result.current.create.mutateAsync(create)
        : action === 'update'
          ? result.current.update.mutateAsync(update)
          : result.current[action].mutateAsync(id);
    await act(async () => {
      fetchMock.mockResolvedValueOnce(
        Response.json({
          success: true,
          data: { ...row, payments: [{ id: 'bad' }] },
        })
      );
      await expect(submit()).rejects.toThrow();
      fetchMock.mockResolvedValueOnce(
        Response.json({ ...row, success: false, error: 'Rejected' })
      );
      await expect(submit()).rejects.toThrow('Rejected');
      if (action !== 'create') {
        fetchMock.mockResolvedValueOnce(
          Response.json({
            success: true,
            data: {
              ...row,
              status,
              _id: '507f1f77bcf86cd799439012',
              id: '507f1f77bcf86cd799439012',
            },
          })
        );
        await expect(submit()).rejects.toThrow();
      }
      if (
        action === 'checkIn' ||
        action === 'checkOut' ||
        action === 'confirm'
      ) {
        fetchMock.mockResolvedValueOnce(
          Response.json({ success: true, data: { ...row, status: null } })
        );
        await expect(submit()).rejects.toThrow();
      }
      if (action === 'create') {
        fetchMock.mockResolvedValueOnce(
          new Response('gateway', { status: 502 })
        );
        await expect(submit()).rejects.toThrow(/^Failed to create booking$/);
      }
      fetchMock.mockResolvedValueOnce(new Response('gateway'));
      await expect(submit()).rejects.toThrow(/Failed to/);
      fetchMock.mockResolvedValueOnce(
        Response.json({ error: 'Booking rejected' }, { status: 409 })
      );
      await expect(submit()).rejects.toThrow('Booking rejected');
      expect(invalidated).not.toHaveBeenCalled();
      const saved = { ...row, status, future: 'retained' };
      fetchMock.mockResolvedValueOnce(
        Response.json({ success: true, data: saved })
      );
      await expect(submit()).resolves.toEqual(saved);
      fetchMock.mockResolvedValueOnce(Response.json(saved));
      await expect(submit()).resolves.toEqual(saved);
    });
    expect(fetchMock).toHaveBeenLastCalledWith('/api/bookings', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    for (const key of related)
      expect(invalidated).toHaveBeenCalledWith({ queryKey: [key] });
    if (action === 'update') {
      expect(addToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Update failed',
          description: 'Booking rejected',
          color: 'danger',
        })
      );
      expect(addToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Booking updated', color: 'success' })
      );
    }
  }
);

test('deletion requires its message acknowledgement and retains generic HTTP errors', async () => {
  const { result, invalidated } = setup();
  await act(async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ error: 'Private' }, { status: 403 })
    );
    await expect(result.current.remove.mutateAsync(id)).rejects.toThrow(
      'Failed to delete booking'
    );
    fetchMock.mockResolvedValueOnce(Response.json({ success: true }));
    await expect(result.current.remove.mutateAsync(id)).rejects.toThrow(
      'Failed to delete booking'
    );
    expect(invalidated).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(
      Response.json({ success: true, message: 'Booking deleted successfully' })
    );
    await expect(
      result.current.remove.mutateAsync(id)
    ).resolves.toBeUndefined();
  });
  expect(fetchMock).toHaveBeenLastCalledWith('/api/bookings?id=' + id, {
    method: 'DELETE',
  });
  for (const key of related)
    expect(invalidated).toHaveBeenCalledWith({ queryKey: [key] });
});

test('a malformed committed receipt acknowledgement retries the same reference and a new payment receives a fresh one', async () => {
  const { result, invalidated } = setup();
  const stored = new Map<
    string,
    { id: string; amount: number; method: string; receivedAt: string }
  >();
  let corrupt = true;
  fetchMock.mockImplementation(async (_url, init) => {
    const { recordPayment } = JSON.parse(String(init?.body));
    expect(recordPayment).toEqual({
      receiptId: expect.any(String),
      amountPaid: 10,
      paymentMethod: 'card',
      notes: 'at desk',
    });
    stored.set(recordPayment.receiptId, {
      id: recordPayment.receiptId,
      amount: recordPayment.amountPaid,
      method: recordPayment.paymentMethod,
      receivedAt: row.checkInDate,
    });
    return Response.json({
      success: true,
      data: { ...row, payments: corrupt ? [] : Array.from(stored.values()) },
    });
  });
  await act(async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ error: 'Amount exceeds balance' }, { status: 409 })
    );
    await expect(
      result.current.payment.mutateAsync({ ...payment, amountPaid: 11 })
    ).rejects.toThrow('Amount exceeds balance');
    expect(stored.size).toBe(0);
    await expect(result.current.payment.mutateAsync(payment)).rejects.toThrow(
      'Failed to record payment'
    );
    expect(stored.size).toBe(1);
    expect(invalidated).not.toHaveBeenCalled();
    corrupt = false;
    await result.current.payment.mutateAsync(payment);
    expect(stored.size).toBe(1);
    await result.current.payment.mutateAsync(payment);
    expect(stored.size).toBe(2);
  });
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/bookings/' + id,
    expect.objectContaining({
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
    })
  );
  for (const key of related)
    expect(invalidated).toHaveBeenCalledWith({ queryKey: [key] });
});

test.each([
  { first: 60, next: 40 },
  { first: 40, next: 40 },
])(
  'a verified receipt retires an ambiguous $first attempt before the next $next payment',
  async ({ first, next }) => {
    const onReconciled = jest.fn();
    const initialBooking: AdminBooking = { ...row, remainingAmount: 100 };
    const { result, rerender } = renderHook(
      ({ booking }: { booking: AdminBooking }) =>
        useRecordPayment({ booking, dialogId, onReconciled }),
      { wrapper, initialProps: { booking: initialBooking } }
    );
    const receipts: NonNullable<AdminBooking['payments']> = [];
    const ids: string[] = [];
    fetchMock.mockImplementation(async (_url, init) => {
      const { recordPayment } = JSON.parse(String(init?.body));
      ids.push(recordPayment.receiptId);
      const existing = receipts.find(r => r.id === recordPayment.receiptId);
      if (
        existing &&
        (existing.amount !== recordPayment.amountPaid ||
          existing.method !== recordPayment.paymentMethod)
      )
        return Response.json(
          { error: 'Payment reference already exists with different details' },
          { status: 409 }
        );
      if (!existing)
        receipts.push({
          id: recordPayment.receiptId,
          amount: recordPayment.amountPaid,
          method: recordPayment.paymentMethod,
          receivedAt: row.checkInDate,
        });
      return Response.json({
        success: true,
        data: ids.length === 1 ? null : { ...row, payments: receipts },
      });
    });
    await act(async () => {
      await expect(
        result.current.mutateAsync({ ...payment, amountPaid: first })
      ).rejects.toThrow('Failed to record payment');
    });
    const receipt = receipts[0];
    const refresh = (payments: AdminBooking['payments']) => {
      const { data: booking } = bookingDetailResponse.parse({
        success: true,
        data: { ...row, remainingAmount: 100 - first, payments },
      });
      rerender({ booking });
    };
    for (const evidence of [
      null,
      [],
      [{ ...receipt, id: 'other' }],
      [{ ...receipt, amount: first + 1 }],
      [{ ...receipt, method: 'cash' as const }],
    ]) {
      refresh(evidence);
      expect(onReconciled).not.toHaveBeenCalled();
    }
    await act(async () => {
      await expect(
        result.current.mutateAsync({ ...payment, amountPaid: first + 1 })
      ).rejects.toThrow('confirm the previous payment');
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    refresh([receipt]);
    expect(onReconciled).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      await result.current.mutateAsync({ ...payment, amountPaid: next });
    });
    expect(receipts.map(r => r.amount)).toEqual([first, next]);
    expect(new Set(ids).size).toBe(2);
  }
);

test('a fresh dialog cannot replay even a byte-identical prior draft as a new payment', async () => {
  const { result, rerender } = renderHook(
    ({ dialogId }: { dialogId: symbol }) =>
      useRecordPayment({ booking: row, dialogId, onReconciled: jest.fn() }),
    { wrapper, initialProps: { dialogId } }
  );
  fetchMock.mockResolvedValueOnce(Response.json({ success: true, data: null }));
  await act(async () => {
    await expect(result.current.mutateAsync(payment)).rejects.toThrow(
      'Failed to record payment'
    );
  });
  rerender({ dialogId: Symbol('second dialog') });
  await act(async () => {
    await expect(result.current.mutateAsync(payment)).rejects.toThrow(
      'confirm the previous payment'
    );
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(result.current.previousPayment).toEqual({
    amount: payment.amountPaid,
    method: payment.paymentMethod,
    notes: payment.notes,
  });
});

test('a rejected cabin replay permits correction after the balance changes and the dialog reopens', async () => {
  const initial: AdminBooking = { ...row, remainingAmount: 50, payments: [] };
  const reduced = {
    ...row,
    remainingAmount: 9,
    payments: [
      {
        id: 'other-receipt',
        amount: 41,
        method: 'cash' as const,
        receivedAt: row.checkInDate,
      },
    ],
  };
  const { result, rerender } = renderHook(
    ({ booking, dialogId }: { booking: AdminBooking; dialogId: symbol }) =>
      useRecordPayment({ booking, dialogId, onReconciled: jest.fn() }),
    { wrapper, initialProps: { booking: initial, dialogId } }
  );
  fetchMock.mockRejectedValueOnce(new Error('Lost response'));
  await act(async () => {
    await expect(result.current.mutateAsync(payment)).rejects.toThrow(
      'Lost response'
    );
  });
  // The old amount is no longer valid in the form, so replay must also be
  // reachable in the same dialog before staff close and reopen it.
  rerender({ booking: reduced, dialogId });
  expect(result.current.previousPayment?.amount).toBe(payment.amountPaid);
  rerender({ booking: reduced, dialogId: Symbol('reopened') });
  const original = patchBookingSchema.parse(
    JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
  ).recordPayment;
  if (!original?.receiptId) throw new Error('Expected the original receipt ID');
  const saved = {
    ...reduced,
    remainingAmount: 0,
    payments: [
      ...reduced.payments,
      {
        id: original.receiptId,
        amount: 9,
        method: payment.paymentMethod,
        receivedAt: row.checkInDate,
      },
    ],
  };
  fetchMock
    .mockResolvedValueOnce(
      Response.json(
        { success: false, error: 'Payment exceeds the outstanding balance' },
        { status: 409 }
      )
    )
    .mockResolvedValueOnce(Response.json({ success: true, data: reduced }))
    .mockResolvedValueOnce(Response.json({ success: true, data: saved }));
  await act(async () => {
    await expect(result.current.retryPreviousPayment()).rejects.toThrow(
      'Payment exceeds the outstanding balance'
    );
  });
  await waitFor(() => {
    expect(result.current.error?.message).toBe(
      'Payment exceeds the outstanding balance'
    );
    expect(result.current.previousPayment).toBeUndefined();
  });
  await act(async () => {
    await expect(
      result.current.mutateAsync({ ...payment, amountPaid: 9 })
    ).resolves.toEqual(saved);
  });
  expect(fetchMock.mock.calls[1]).toEqual(fetchMock.mock.calls[0]);
  expect(
    JSON.parse(String(fetchMock.mock.calls[3][1]?.body)).recordPayment
  ).toEqual({ ...original, amountPaid: 9 });
});

test('a cached booking revalidates its own SWR key after selection changes', async () => {
  const url = (id: string) => '/api/bookings/' + id;
  const second = '507f1f77bcf86cd799439012';
  const cache = new Map<string, { data?: unknown; error?: unknown }>([
    [url(id), { data: row }],
  ]);
  fetchMock.mockImplementation(async input => {
    const selected = String(input).slice('/api/bookings/'.length);
    return Response.json({
      success: true,
      data: { ...row, id: selected, _id: selected, revision: 2 },
    });
  });
  const frames: FrameRequestCallback[] = [];
  const raf = jest
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation(frame => frames.push(frame));
  const config = { provider: () => cache, shouldRetryOnError: false };
  try {
    const view = renderHook(({ id }) => useBooking(id), {
      initialProps: { id },
      wrapper: ({ children }) =>
        createElement(SWRConfig, { value: config }, children),
    });
    view.rerender({ id: second });
    await act(async () => {
      frames.splice(0).forEach(frame => frame(0));
    });
    expect(fetchMock.mock.calls).toEqual([[url(second)], [url(id)]]);
    expect(cache.get(url(id))?.error).toBeUndefined();
    expect(cache.get(url(id))?.data).toEqual({ ...row, revision: 2 });
  } finally {
    raf.mockRestore();
  }
});

test.each([
  'reopen',
  'resource',
  'staff',
  'session',
  'dialog',
  'active',
] as const)(
  'only the current receipt owner dispatches on reconnect after %s',
  async change => {
    const second = '507f1f77bcf86cd799439012';
    fetchMock.mockImplementation(async (_url, init) => {
      const { recordPayment } = patchBookingSchema.parse(
        JSON.parse(String(init?.body))
      );
      if (!recordPayment?.receiptId)
        throw new Error('Expected the submitted receipt ID');
      return Response.json({
        success: true,
        data: {
          ...row,
          payments: [
            {
              id: recordPayment.receiptId,
              amount: recordPayment.amountPaid,
              method: recordPayment.paymentMethod,
              receivedAt: row.checkInDate,
            },
          ],
        },
      });
    });
    const mount = () =>
      renderHook(
        ({ booking, dialogId }) =>
          useRecordPayment({ booking, dialogId, onReconciled: jest.fn() }),
        { initialProps: { booking: row, dialogId }, wrapper }
      );
    onlineManager.setOnline(false);
    try {
      const first = mount();
      const enqueue = (owner: ReturnType<typeof mount>) => {
        const promise = owner.result.current.mutateAsync(payment);
        // The offline mutation can reject as soon as the test restores connectivity.
        void promise.catch(() => {});
        return promise;
      };
      const initial = enqueue(first);
      await waitFor(() => expect(first.result.current.isPaused).toBe(true));
      let latest: Promise<AdminBooking> | undefined;
      if (change === 'reopen') {
        first.unmount();
        const next = mount();
        latest = enqueue(next);
        await waitFor(() => expect(next.result.current.isPaused).toBe(true));
      } else if (change === 'resource')
        first.rerender({
          booking: { ...row, id: second, _id: second },
          dialogId,
        });
      else if (change === 'dialog')
        first.rerender({ booking: row, dialogId: Symbol() });
      else if (change === 'staff' || change === 'session') {
        mockStaff =
          change === 'staff'
            ? { ...mockStaff, userId: 'another' }
            : { ...mockStaff, sessionId: 'another' };
        first.rerender({ booking: row, dialogId });
      }
      expect(fetchMock).not.toHaveBeenCalled();
      await act(async () => {
        onlineManager.setOnline(true);
        if (change === 'active') await initial;
        else await expect(initial).rejects.toThrow();
        if (latest) await latest;
      });
      expect(fetchMock).toHaveBeenCalledTimes(
        change === 'active' || change === 'reopen' ? 1 : 0
      );
    } finally {
      onlineManager.setOnline(true);
    }
  }
);
