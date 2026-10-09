import { createElement, type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query';
import useSWR, { SWRConfig } from 'swr';
import {
  useBooking,
  useBookingByEmail,
  useBookings,
  useUpdateBooking,
} from '@/hooks/useBookings';
import {
  useCreateCustomer,
  useCustomer,
  useCustomers,
  useDeleteCustomer,
  useUpdateCustomer,
} from '@/hooks/useCustomers';
import type { CreateCustomerInput } from '@/lib/validations/customer';
import { useInfiniteCustomers } from '@/hooks/useInfiniteCustomers';
import {
  useResetSettings,
  useSettings,
  useUpdateSettings,
} from '@/hooks/useSettings';
import type { AppSettings, Customer, PopulatedBooking } from '@/types';

jest.unmock('swr');

const originalFetch = global.fetch;
const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
let client: QueryClient;

function response(body: unknown, ok = true): Response {
  const checked = { ok, json: async () => body } satisfies Pick<
    Response,
    'ok' | 'json'
  >;
  return checked as Response;
}
function wrapper({ children }: { children: ReactNode }) {
  return createElement(
    QueryClientProvider,
    { client },
    createElement(
      SWRConfig,
      {
        value: {
          provider: () => new Map(),
          dedupingInterval: 0,
          revalidateOnFocus: false,
        },
      },
      children
    )
  );
}
const booking = (numGuests: number): PopulatedBooking => ({
  _id: 'booking_1',
  id: 'booking_1',
  checkInDate: '2040-01-01T00:00:00.000Z',
  checkOutDate: '2040-01-02T00:00:00.000Z',
  numNights: 1,
  numGuests,
  status: 'confirmed',
  cabinPrice: 100,
  extrasPrice: 0,
  totalPrice: 100,
  isPaid: false,
  amountPaid: 0,
  depositPaid: false,
  depositAmount: 50,
  remainingAmount: 100,
  customer: { id: 'user_1', name: 'Jane Guest', email: 'jane@example.com' },
  guest: { id: 'user_1', name: 'Jane Guest', email: 'jane@example.com' },
  cabin: null,
});
const bookingWithCustomer = (name: string): PopulatedBooking => ({
  ...booking(1),
  customer: { id: 'user_1', name, email: 'jane@example.com' },
  guest: { id: 'user_1', name, email: 'jane@example.com' },
});
const customer = (name: string): Customer => ({
  id: 'user_1',
  name,
  first_name: name.split(' ')[0],
  last_name: 'Guest',
  username: null,
  email: 'jane@example.com',
  image_url: '',
  has_image: false,
  created_at: '2030-01-01T00:00:00.000Z',
  updated_at: '2030-01-01T00:00:00.000Z',
  last_sign_in_at: null,
  last_active_at: '2030-01-01T00:00:00.000Z',
  banned: false,
  locked: false,
  lockout_expires_in_seconds: null,
  totalBookings: 0,
  totalSpent: 0,
  loyaltyTier: 'Bronze',
});
const settings: AppSettings = {
  _id: 'settings',
  id: 'settings',
  singleton: 'global',
  fullAddress: '',
  minBookingLength: 1,
  maxBookingLength: 30,
  maxGuestsPerBooking: 8,
  breakfastPrice: 2,
  checkInTime: '15:00',
  checkOutTime: '11:00',
  cancellationPolicy: 'moderate',
  requireDeposit: true,
  depositPercentage: 50,
  allowPets: true,
  petFee: 2,
  smokingAllowed: false,
  earlyCheckInFee: 3,
  lateCheckOutFee: 4,
  wifiIncluded: true,
  parkingIncluded: false,
  parkingFee: 1,
  currency: 'EUR',
  timezone: 'UTC',
  businessHours: { open: '09:00', close: '17:00', daysOpen: [] },
  notifications: {
    emailEnabled: true,
    smsEnabled: false,
    bookingConfirmation: true,
    paymentReminders: true,
    checkInReminders: true,
  },
};

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});
afterEach(() => {
  client.clear();
  global.fetch = originalFetch;
});

test('booking success refreshes filtered list, detail, by-email and stats; failure leaves reads alone', async () => {
  let guests = 1;
  let failUpdate = false;
  fetchMock.mockImplementation(async (input, init) => {
    const url = String(input);
    if (init?.method === 'PUT') {
      if (failUpdate) return response({ error: 'Rejected' }, false);
      guests = 2;
      return response({ success: true, data: booking(guests) });
    }
    if (url === '/api/cabins?') return response({ value: 'unrelated' });
    if (url === '/api/sales' || url === '/api/dashboard') {
      return response({ revision: guests });
    }
    if (url.startsWith('/api/bookings?')) {
      return response({
        success: true,
        data: [booking(guests)],
        pagination: { currentPage: 2 },
      });
    }
    return response({ success: true, data: booking(guests) });
  });
  const invalidated = jest.spyOn(client, 'invalidateQueries');
  const { result } = renderHook(
    () => ({
      list: useBookings({ page: 2, status: 'confirmed' }),
      detail: useBooking('booking_1'),
      email: useBookingByEmail('jane@example.com'),
      sales: useQuery({
        queryKey: ['sales'],
        queryFn: async () => (await fetch('/api/sales')).json(),
      }),
      durations: useQuery({
        queryKey: ['durations'],
        queryFn: async () => (await fetch('/api/dashboard')).json(),
      }),
      unrelated: useSWR('/api/cabins?', async url => (await fetch(url)).json()),
      update: useUpdateBooking(),
    }),
    { wrapper }
  );
  await waitFor(() => expect(result.current.email.data?.numGuests).toBe(1));
  await waitFor(() =>
    expect(result.current.list.data?.bookings[0].numGuests).toBe(1)
  );
  await waitFor(() =>
    expect(result.current.sales.data).toEqual({ revision: 1 })
  );
  await waitFor(() =>
    expect(result.current.durations.data).toEqual({ revision: 1 })
  );
  const unrelatedReads = fetchMock.mock.calls.filter(
    ([url]) => url === '/api/cabins?'
  ).length;

  await act(async () => {
    expect(
      await result.current.update.mutateAsync({
        _id: 'booking_1',
        numGuests: 2,
      })
    ).toEqual(booking(2));
  });
  await waitFor(() =>
    expect(result.current.list.data?.bookings[0].numGuests).toBe(2)
  );
  await waitFor(() => expect(result.current.detail.data?.numGuests).toBe(2));
  await waitFor(() => expect(result.current.email.data?.numGuests).toBe(2));
  await waitFor(() =>
    expect(result.current.sales.data).toEqual({ revision: 2 })
  );
  await waitFor(() =>
    expect(result.current.durations.data).toEqual({ revision: 2 })
  );
  expect(
    fetchMock.mock.calls.filter(([url]) => url === '/api/cabins?')
  ).toHaveLength(unrelatedReads);
  for (const key of [
    'bookings',
    'activities',
    'overview',
    'booking-analytics',
    'booking-stats',
    'sales',
    'durations',
  ]) {
    expect(invalidated).toHaveBeenCalledWith({ queryKey: [key] });
  }

  const beforeFailure = fetchMock.mock.calls.length;
  const beforeInvalidations = invalidated.mock.calls.length;
  failUpdate = true;
  await act(async () => {
    await expect(
      result.current.update.mutateAsync({ _id: 'booking_1', numGuests: 3 })
    ).rejects.toThrow('Rejected');
  });
  expect(fetchMock.mock.calls.length).toBe(beforeFailure + 1);
  expect(invalidated).toHaveBeenCalledTimes(beforeInvalidations);
  expect(result.current.list.data?.bookings[0].numGuests).toBe(2);
  expect(result.current.sales.data).toEqual({ revision: 2 });
  expect(result.current.durations.data).toEqual({ revision: 2 });

  guests = 3;
  await act(async () => {
    await result.current.list.mutate();
  });
  expect(result.current.list.data?.bookings[0].numGuests).toBe(3);
});

test('customer success refreshes SWR list/detail and the infinite customer search; failure does not', async () => {
  let name = 'Jane Guest';
  let failUpdate = false;
  fetchMock.mockImplementation(async (input, init) => {
    const url = String(input);
    if (init?.method === 'PUT') {
      if (failUpdate) return response({ error: 'Rejected' }, false);
      name = 'Janet Guest';
      return response({ success: true, data: customer(name) });
    }
    if (url === '/api/customers/user_1')
      return response({ success: true, data: customer(name) });
    if (url.startsWith('/api/bookings?')) {
      return response({
        success: true,
        data: [bookingWithCustomer(name)],
        pagination: { currentPage: 2 },
      });
    }
    if (url.startsWith('/api/bookings/')) {
      return response({ success: true, data: bookingWithCustomer(name) });
    }
    return response({
      success: true,
      data: [customer(name)],
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalCustomers: 1,
        limit: 20,
        hasNextPage: false,
        hasPrevPage: false,
      },
    });
  });
  const invalidated = jest.spyOn(client, 'invalidateQueries');
  const { result } = renderHook(
    () => ({
      list: useCustomers({ page: 2, search: 'jane' }),
      detail: useCustomer('user_1'),
      infinite: useInfiniteCustomers(),
      bookingList: useBookings({ page: 2, search: 'jane' }),
      bookingDetail: useBooking('booking_1'),
      bookingEmail: useBookingByEmail('jane@example.com'),
      update: useUpdateCustomer(),
    }),
    { wrapper }
  );
  await waitFor(() =>
    expect(result.current.infinite.customers[0]?.name).toBe('Jane Guest')
  );
  await waitFor(() =>
    expect(result.current.list.data[0]?.name).toBe('Jane Guest')
  );
  await waitFor(() =>
    expect(result.current.bookingEmail.data?.guest?.name).toBe('Jane Guest')
  );
  await act(async () => {
    expect(
      await result.current.update.mutateAsync({
        id: 'user_1',
        firstName: 'Janet',
      })
    ).toEqual(customer('Janet Guest'));
  });
  await waitFor(() =>
    expect(result.current.list.data[0]?.name).toBe('Janet Guest')
  );
  await waitFor(() =>
    expect(result.current.detail.data?.name).toBe('Janet Guest')
  );
  await waitFor(() =>
    expect(result.current.infinite.customers[0]?.name).toBe('Janet Guest')
  );
  await waitFor(() =>
    expect(result.current.bookingList.data?.bookings[0].guest?.name).toBe(
      'Janet Guest'
    )
  );
  await waitFor(() =>
    expect(result.current.bookingDetail.data?.guest?.name).toBe('Janet Guest')
  );
  await waitFor(() =>
    expect(result.current.bookingEmail.data?.guest?.name).toBe('Janet Guest')
  );
  expect(invalidated).toHaveBeenCalledWith({ queryKey: ['customers'] });
  expect(invalidated).toHaveBeenCalledWith({ queryKey: ['activities'] });

  const beforeFailure = fetchMock.mock.calls.length;
  const beforeInvalidations = invalidated.mock.calls.length;
  failUpdate = true;
  await act(async () => {
    await expect(
      result.current.update.mutateAsync({ id: 'user_1', firstName: 'No' })
    ).rejects.toThrow('Rejected');
  });
  expect(fetchMock.mock.calls.length).toBe(beforeFailure + 1);
  expect(invalidated).toHaveBeenCalledTimes(beforeInvalidations);
  expect(result.current.bookingList.data?.bookings[0].guest?.name).toBe(
    'Janet Guest'
  );
});

test('customer create and delete also refresh the dashboard customer count', async () => {
  fetchMock.mockImplementation(async (_input, init) =>
    response(
      init?.method === 'DELETE'
        ? { success: true }
        : { success: true, data: customer('Jane Guest') }
    )
  );
  const invalidated = jest.spyOn(client, 'invalidateQueries');
  const { result } = renderHook(
    () => ({
      create: useCreateCustomer(),
      remove: useDeleteCustomer(),
    }),
    { wrapper }
  );
  const input = {
    firstName: 'Jane',
    lastName: 'Guest',
    email: 'jane@example.com',
    password: 'test-password',
  } satisfies CreateCustomerInput;
  await act(async () => {
    expect(await result.current.create.mutateAsync(input)).toEqual(
      customer('Jane Guest')
    );
  });
  expect(invalidated).toHaveBeenCalledWith({ queryKey: ['overview'] });
  invalidated.mockClear();
  await act(async () => {
    expect(await result.current.remove.mutateAsync('user_1')).toEqual({
      success: true,
    });
  });
  expect(invalidated).toHaveBeenCalledWith({ queryKey: ['overview'] });
  expect(invalidated).toHaveBeenCalledWith({ queryKey: ['activities'] });
});

test('settings update and reset refresh the mounted read; failed update does not', async () => {
  let current = settings;
  let failUpdate = false;
  let failRead = false;
  fetchMock.mockImplementation(async (_input, init) => {
    if (init?.method === 'PUT') {
      if (failUpdate) return response({ error: 'Rejected' }, false);
      current = { ...current, minBookingLength: 2 };
    }
    if (init?.method === 'POST') current = settings;
    if (!init?.method && failRead) return response({}, false);
    return response({ success: true, data: current });
  });
  const { result } = renderHook(
    () => ({
      read: useSettings(),
      update: useUpdateSettings(),
      reset: useResetSettings(),
    }),
    { wrapper }
  );
  await waitFor(() =>
    expect(result.current.read.data?.minBookingLength).toBe(1)
  );
  await act(async () => {
    expect(
      await result.current.update.mutateAsync({ minBookingLength: 2 })
    ).toEqual({ ...settings, minBookingLength: 2 });
  });
  await waitFor(() =>
    expect(result.current.read.data?.minBookingLength).toBe(2)
  );
  const beforeFailure = fetchMock.mock.calls.length;
  failUpdate = true;
  await act(async () => {
    await expect(
      result.current.update.mutateAsync({ minBookingLength: 3 })
    ).rejects.toThrow('Rejected');
  });
  expect(fetchMock.mock.calls.length).toBe(beforeFailure + 1);
  expect(result.current.read.data?.minBookingLength).toBe(2);
  await act(async () => {
    expect(await result.current.reset.mutateAsync()).toEqual(settings);
  });
  await waitFor(() =>
    expect(result.current.read.data?.minBookingLength).toBe(1)
  );

  failUpdate = false;
  failRead = true;
  await act(async () => {
    expect(
      await result.current.update.mutateAsync({ minBookingLength: 2 })
    ).toEqual({
      ...settings,
      minBookingLength: 2,
    });
  });
  await waitFor(() =>
    expect(result.current.read.error?.message).toBe('Failed to fetch settings')
  );
});
