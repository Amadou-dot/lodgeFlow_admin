/** @jest-environment ./__tests__/setup/fetch-jsdom.cjs */
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
import type {
  AppSettings,
  Customer,
  CustomerWithStats,
  PopulatedBooking,
} from '@/types';

import { customerDetailFixture } from '../setup/customer-json';

jest.unmock('swr');

const originalFetch = global.fetch;
const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
let client: QueryClient;

function response(body: unknown, ok = true): Response {
  return Response.json(body, { status: ok ? 200 : 400 });
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
          shouldRetryOnError: false,
        },
      },
      children
    )
  );
}
const booking = (numGuests: number): PopulatedBooking => ({
  _id: '507f1f77bcf86cd799439011',
  id: '507f1f77bcf86cd799439011',
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
const bookingPagination = {
  currentPage: 2,
  totalPages: 2,
  totalBookings: 2,
  limit: 1,
  hasNextPage: false,
  hasPrevPage: true,
};
function leanBooking(guests: number) {
  const { id, guest, ...stored } = booking(guests);
  return { ...stored, customer: 'user_1' };
}
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
const customerDetail = (name: string): CustomerWithStats => ({
  ...customerDetailFixture,
  ...customer(name),
  recentBookings: [],
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
    if (url.startsWith('/api/bookings/by-email?'))
      return response({ success: true, data: leanBooking(guests) });
    if (url.startsWith('/api/bookings?')) {
      return response({
        success: true,
        data: [booking(guests)],
        pagination: bookingPagination,
      });
    }
    return response({ success: true, data: booking(guests) });
  });
  const invalidated = jest.spyOn(client, 'invalidateQueries');
  const { result } = renderHook(
    () => ({
      list: useBookings({ page: 2, status: 'confirmed' }),
      detail: useBooking('507f1f77bcf86cd799439011'),
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
        _id: '507f1f77bcf86cd799439011',
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
      result.current.update.mutateAsync({
        _id: '507f1f77bcf86cd799439011',
        numGuests: 3,
      })
    ).rejects.toThrow('Rejected');
  });
  expect(fetchMock.mock.calls.length).toBe(beforeFailure + 1);
  expect(invalidated).toHaveBeenCalledTimes(beforeInvalidations);
  expect(result.current.list.data?.bookings[0].numGuests).toBe(2);
  expect(result.current.sales.data).toEqual({ revision: 2 });
  expect(result.current.durations.data).toEqual({ revision: 2 });

  fetchMock.mockResolvedValueOnce(
    response({
      success: true,
      data: [{ ...booking(3), numGuests: null }],
      pagination: bookingPagination,
    })
  );
  await act(async () => {
    await result.current.list.mutate();
  });
  expect(result.current.list.error?.message).toBe('Failed to fetch bookings');
  expect(result.current.list.data?.bookings[0].numGuests).toBe(2);
  guests = 3;
  await act(async () => {
    await result.current.list.mutate();
  });
  expect(result.current.list.data?.bookings[0].numGuests).toBe(3);
});

test('malformed read variants cannot replace the last valid list, detail or lean row', async () => {
  const valid = booking(2);
  const stored = leanBooking(2);
  const list = {
    success: true,
    data: [valid],
    pagination: bookingPagination,
    _clerkWarning: 'Partial Clerk lookup',
  };
  const detail = { success: true, data: valid };
  const email = { success: true, data: stored };
  fetchMock.mockImplementation(async url =>
    response(
      String(url).includes('by-email')
        ? email
        : String(url).includes('bookings?')
          ? list
          : detail
    )
  );
  const { result } = renderHook(
    () => ({
      list: useBookings(),
      detail: useBooking(valid._id),
      email: useBookingByEmail('jane@example.com'),
    }),
    { wrapper }
  );
  await waitFor(() => {
    expect(result.current.list.data?._clerkWarning).toBe(list._clerkWarning);
    expect(result.current.detail.data).toEqual(valid);
    expect(result.current.email.data).toEqual(stored);
  });
  for (const invalid of [
    { ...list, pagination: { currentPage: 1 } },
    { ...list, _clerkWarning: 42 },
    { ...list, data: [{ ...valid, guest: null }] },
  ]) {
    fetchMock.mockResolvedValueOnce(response(invalid));
    await act(async () => {
      await result.current.list.mutate();
    });
    expect(result.current.list.error?.message).toBe('Failed to fetch bookings');
    expect(result.current.list.data?.bookings).toEqual([valid]);
  }
  for (const invalid of [
    { ...detail, data: { ...valid, id: 'bad' } },
    { ...detail, data: { ...valid, checkInDate: '2040-02-30' } },
    { ...detail, data: { ...valid, status: 'bogus' } },
    { ...detail, data: { ...valid, totalPrice: null } },
    { ...detail, data: { ...valid, customer: 'user_1' } },
    { ...detail, data: { ...valid, extras: { petFee: 'bad' } } },
    { ...detail, data: { ...valid, cancellationRefunds: [{ amount: 1 }] } },
    {
      ...detail,
      data: {
        ...valid,
        id: '507f1f77bcf86cd799439012',
        _id: '507f1f77bcf86cd799439012',
      },
    },
  ]) {
    fetchMock.mockResolvedValueOnce(response(invalid));
    await act(async () => {
      await result.current.detail.mutate();
    });
    expect(result.current.detail.error?.message).toBe(
      'Failed to fetch booking'
    );
    expect(result.current.detail.data).toEqual(valid);
  }
  for (const invalid of [
    stored,
    detail,
    { ...email, data: { ...stored, customer: '' } },
    { ...email, data: { ...stored, cabin: { name: 'Pine' } } },
  ]) {
    fetchMock.mockResolvedValueOnce(response(invalid));
    await act(async () => {
      await result.current.email.mutate();
    });
    expect(result.current.email.error?.message).toBe('Failed to fetch booking');
    expect(result.current.email.data).toEqual(stored);
  }
});

test('customer success refreshes SWR list/detail and the infinite customer search; failure does not', async () => {
  let name = 'Jane Guest';
  let updateFailure: Response | undefined;
  fetchMock.mockImplementation(async (input, init) => {
    const url = String(input);
    if (init?.method === 'PUT') {
      if (updateFailure) return updateFailure;
      name = 'Janet Guest';
      return response({ success: true, data: customer(name) });
    }
    if (url === '/api/customers/user_1')
      return response({ success: true, data: customerDetail(name) });
    if (url.startsWith('/api/bookings/by-email?'))
      return response({
        success: true,
        data: { ...leanBooking(1), observations: name },
      });
    if (url.startsWith('/api/bookings?')) {
      return response({
        success: true,
        data: [bookingWithCustomer(name)],
        pagination: bookingPagination,
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
      bookingDetail: useBooking('507f1f77bcf86cd799439011'),
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
    expect(result.current.bookingEmail.data?.observations).toBe('Jane Guest')
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
    expect(result.current.bookingEmail.data?.observations).toBe('Janet Guest')
  );
  expect(invalidated.mock.calls).toEqual([
    [{ queryKey: ['customers'] }],
    [{ queryKey: ['activities'] }],
  ]);

  const beforeFailure = fetchMock.mock.calls.length;
  const beforeInvalidations = invalidated.mock.calls.length;
  updateFailure = response({ error: 'Rejected' }, false);
  await act(async () => {
    await expect(
      result.current.update.mutateAsync({ id: 'user_1', firstName: 'No' })
    ).rejects.toThrow('Rejected');
  });
  updateFailure = response({
    success: true,
    data: { ...customer('No'), totalSpent: 'unknown' },
  });
  await act(async () => {
    await expect(
      result.current.update.mutateAsync({ id: 'user_1', firstName: 'No' })
    ).rejects.toThrow('Failed to update customer');
  });
  expect(fetchMock.mock.calls.length).toBe(beforeFailure + 2);
  expect(invalidated).toHaveBeenCalledTimes(beforeInvalidations);
  expect(result.current.detail.data).toEqual(customerDetail('Janet Guest'));
  expect(result.current.list.data).toEqual([customer('Janet Guest')]);
  expect(result.current.infinite.customers).toEqual([customer('Janet Guest')]);
  expect(result.current.bookingList.data?.bookings[0].guest?.name).toBe(
    'Janet Guest'
  );
});

test('customer create and delete refresh customer reads and their dashboard keys only after valid replies', async () => {
  let name = 'Jane Guest';
  let malformed = false;
  fetchMock.mockImplementation(async (url, init) => {
    if (init?.method === 'POST') {
      if (malformed) return response({ success: true, data: { id: 'broken' } });
      name = 'Created Guest';
      return response({
        success: true,
        data: customer(name),
        message: 'Customer created successfully',
      });
    }
    if (init?.method === 'DELETE') {
      if (malformed) return response({ success: 1 });
      name = 'Remaining Guest';
      return response({ success: true });
    }
    if (url === '/api/customers/user_1')
      return response({ success: true, data: customerDetail(name) });
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
      create: useCreateCustomer(),
      remove: useDeleteCustomer(),
      detail: useCustomer('user_1'),
      list: useCustomers(),
      infinite: useInfiniteCustomers(),
    }),
    { wrapper }
  );
  const waitForCustomers = async (expectedName: string) => {
    await waitFor(() => {
      expect(result.current.detail.data).toEqual(customerDetail(expectedName));
      expect(result.current.list.data).toEqual([customer(expectedName)]);
      expect(result.current.infinite.customers).toEqual([
        customer(expectedName),
      ]);
    });
  };
  await waitForCustomers('Jane Guest');
  const input: CreateCustomerInput = {
    firstName: 'Jane',
    lastName: 'Guest',
    email: 'jane@example.com',
    password: 'test-password',
  };
  await act(async () => {
    expect(await result.current.create.mutateAsync(input)).toEqual(
      customer('Created Guest')
    );
  });
  await waitForCustomers('Created Guest');
  expect(invalidated.mock.calls).toEqual([
    [{ queryKey: ['customers'] }],
    [{ queryKey: ['overview'] }],
  ]);

  invalidated.mockClear();
  malformed = true;
  const requestsBeforeFailures = fetchMock.mock.calls.length;
  await act(async () => {
    await expect(result.current.create.mutateAsync(input)).rejects.toThrow(
      'Failed to create customer'
    );
    await expect(result.current.remove.mutateAsync('user_1')).rejects.toThrow(
      'Failed to delete customer'
    );
  });
  expect(invalidated).not.toHaveBeenCalled();
  expect(fetchMock).toHaveBeenCalledTimes(requestsBeforeFailures + 2);
  await waitForCustomers('Created Guest');

  malformed = false;
  await act(async () => {
    expect(await result.current.remove.mutateAsync('user_1')).toEqual({
      success: true,
    });
  });
  await waitForCustomers('Remaining Guest');
  expect(invalidated.mock.calls).toEqual([
    [{ queryKey: ['customers'] }],
    [{ queryKey: ['overview'] }],
    [{ queryKey: ['activities'] }],
  ]);
});

const legacyBooking = {
  _id: '507f1f77bcf86cd799439012',
  id: '507f1f77bcf86cd799439012',
  customer: 'user_1',
  checkInDate: '2040-06-01T23:30:00.000Z',
  checkOutDate: '2040-06-03T23:30:00.000Z',
  numNights: 2,
  numGuests: 2,
  status: 'checked-out',
  cabinPrice: 100.125,
  extrasPrice: 0,
  totalPrice: 100.125,
  isPaid: false,
  amountPaid: 0,
  depositPaid: false,
  depositAmount: 0,
  remainingAmount: 100.125,
  cabin: null,
  payments: null,
  checkoutToken: null,
  refundAmount: null,
  cancelledAt: null,
  future: { note: 'Preserved' },
} satisfies CustomerWithStats['recentBookings'][number] & { future: unknown };

const richCustomer = {
  ...customerDetail('Jane Guest'),
  recentBookings: [legacyBooking],
  preferences: { dietaryRestrictions: ['Vegan'], future: 'retained' },
  totalRevenue: -100.125,
  future: 'retained',
};
const detailSuccess = { success: true, data: richCustomer, future: true };

test('customer detail preserves legacy amounts, sparse metadata and additive nested values', async () => {
  fetchMock.mockResolvedValue(response(detailSuccess));
  const { result } = renderHook(() => useCustomer('user_1'), { wrapper });
  await waitFor(() => expect(result.current.data).toEqual(richCustomer));
  expect(result.current.data?.recentBookings[0]?.cabin).toBeNull();
  expect(result.current.data?.lastBookingDate).toBeUndefined();
});

test.each([
  { label: 'JSON null', reply: () => response(null) },
  { label: 'JSON primitive', reply: () => response(42) },
  {
    label: 'invalid JSON',
    reply: () => new Response('<html>Private error</html>'),
  },
  { label: 'missing data', reply: () => response({ success: true }) },
  { label: 'wrong data', reply: () => response({ success: true, data: [] }) },
  {
    label: 'missing completed bookings',
    reply: () =>
      response({
        ...detailSuccess,
        data: { ...richCustomer, completedBookings: undefined },
      }),
  },
  {
    label: 'wrong total revenue',
    reply: () =>
      response({
        ...detailSuccess,
        data: { ...richCustomer, totalRevenue: 'unknown' },
      }),
  },
  {
    label: 'wrong average stay length',
    reply: () =>
      response({
        ...detailSuccess,
        data: { ...richCustomer, averageStayLength: null },
      }),
  },
  {
    label: 'missing recent bookings',
    reply: () =>
      response({
        ...detailSuccess,
        data: { ...richCustomer, recentBookings: undefined },
      }),
  },
  {
    label: 'malformed booking',
    reply: () =>
      response({
        ...detailSuccess,
        data: {
          ...richCustomer,
          recentBookings: [{ ...legacyBooking, cabin: { name: 'Pine' } }],
        },
      }),
  },
  {
    label: 'unknown booking status',
    reply: () =>
      response({
        ...detailSuccess,
        data: {
          ...richCustomer,
          recentBookings: [{ ...legacyBooking, status: 'bogus' }],
        },
      }),
  },
  {
    label: 'nonliteral success',
    reply: () => response({ ...detailSuccess, success: 'true' }),
  },
  {
    label: 'malformed message',
    reply: () => response({ ...detailSuccess, message: {} }),
  },
  {
    label: 'malformed error',
    reply: () => response({ ...detailSuccess, error: 123 }),
  },
  {
    label: 'contradictory error',
    reply: () => response({ ...detailSuccess, error: 'Rejected' }),
  },
  {
    label: '2xx API error',
    reply: () => response({ success: false, error: 'Private error' }),
  },
  {
    label: 'HTTP failure with a valid body',
    reply: () => response(detailSuccess, false),
  },
])(
  'customer detail retains valid data after $label and recovers on retry',
  async ({ reply }) => {
    fetchMock.mockResolvedValue(response(detailSuccess));
    const { result } = renderHook(() => useCustomer('user_1'), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(richCustomer));

    fetchMock.mockResolvedValue(reply());
    await act(async () => {
      await result.current.mutate();
    });
    expect(result.current.error?.message).toBe('Failed to fetch customer');
    expect(result.current.data).toEqual(richCustomer);

    const recovered = customerDetail('Janet Guest');
    fetchMock.mockResolvedValue(response({ success: true, data: recovered }));
    await act(async () => {
      await result.current.mutate();
    });
    expect(result.current.error).toBeUndefined();
    expect(result.current.data).toEqual(recovered);
  }
);

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
