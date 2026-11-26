/** @jest-environment ./__tests__/setup/fetch-jsdom.cjs */
import { createElement, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { addToast } from '@heroui/toast';
import type { CreateBookingInput } from '@/types/api';
import {
  useCheckInBooking,
  useCheckOutBooking,
  useConfirmBooking,
  useCreateBooking,
  useDeleteBooking,
  useRecordPayment,
  useUpdateBooking,
} from '@/hooks/useBookings';

jest.unmock('swr');
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
    payment: useRecordPayment(),
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
        expect.objectContaining({ title: 'Update failed', color: 'danger' })
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
    expect.objectContaining({ method: 'PATCH' })
  );
  for (const key of related)
    expect(invalidated).toHaveBeenCalledWith({ queryKey: [key] });
});
