// Mock @tanstack/react-query before imports
let capturedMutationConfig: any = null;

const mockInvalidateQueries = jest.fn();
const mockQueryClient = { invalidateQueries: mockInvalidateQueries };

jest.mock('@tanstack/react-query', () => ({
  useMutation: jest.fn((config: any) => {
    capturedMutationConfig = config;
    return {
      mutate: jest.fn(),
      mutateAsync: jest.fn(),
      isPending: false,
      isError: false,
      isSuccess: false,
      reset: jest.fn(),
    };
  }),
  useQueryClient: jest.fn(() => mockQueryClient),
}));

jest.mock('@heroui/toast', () => ({
  addToast: jest.fn(),
}));

import { addToast } from '@heroui/toast';
import {
  useCheckInBooking,
  useCheckOutBooking,
  useConfirmBooking,
  useCreateBooking,
  useDeleteBooking,
  useRecordPayment,
  useUpdateBooking,
} from '@/hooks/useBookings';

const INVALIDATED_KEYS = [
  ['bookings'],
  ['activities'],
  ['overview'],
  ['booking-analytics'],
];

function expectCacheInvalidation() {
  for (const queryKey of INVALIDATED_KEYS) {
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey });
  }
}

beforeEach(() => {
  capturedMutationConfig = null;
  jest.clearAllMocks();
  (global.fetch as jest.Mock) = jest.fn();
});

describe('useCreateBooking', () => {
  const bookingInput = { cabin: 'cabin_1', numGuests: 2 } as any;

  it('POSTs the booking payload and returns the created booking', async () => {
    const created = { _id: 'b1', numGuests: 2 };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: created }),
    });

    useCreateBooking();
    const result = await capturedMutationConfig.mutationFn(bookingInput);

    expect(global.fetch).toHaveBeenCalledWith('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookingInput),
    });
    expect(result).toEqual(created);
  });

  it('throws the API error message on failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Cabin is already booked' }),
    });

    useCreateBooking();

    await expect(
      capturedMutationConfig.mutationFn(bookingInput)
    ).rejects.toThrow('Cabin is already booked');
  });

  it('throws a fallback message when the error body is unreadable', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error('not json')),
    });

    useCreateBooking();

    await expect(
      capturedMutationConfig.mutationFn(bookingInput)
    ).rejects.toThrow('Failed to create booking');
  });

  it('invalidates booking-related caches on success', () => {
    useCreateBooking();
    capturedMutationConfig.onSuccess();

    expectCacheInvalidation();
  });
});

describe('useRecordPayment', () => {
  const payment = {
    bookingId: 'b1',
    paymentMethod: 'card' as const,
    amountPaid: 100,
    notes: 'paid at desk',
  };

  it('PATCHes the booking with a recordPayment payload', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { _id: 'b1' } }),
    });

    useRecordPayment();
    await capturedMutationConfig.mutationFn(payment);

    expect(global.fetch).toHaveBeenCalledWith('/api/bookings/b1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recordPayment: {
          paymentMethod: 'card',
          amountPaid: 100,
          notes: 'paid at desk',
        },
      }),
    });
  });

  it('throws the API error message on failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Amount exceeds balance' }),
    });

    useRecordPayment();

    await expect(capturedMutationConfig.mutationFn(payment)).rejects.toThrow(
      'Amount exceeds balance'
    );
  });

  it('invalidates booking-related caches on success', () => {
    useRecordPayment();
    capturedMutationConfig.onSuccess();

    expectCacheInvalidation();
  });
});

describe('useUpdateBooking', () => {
  const update = { _id: 'b1', numGuests: 3 } as any;

  it('PUTs the update payload', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: update }),
    });

    useUpdateBooking();
    const result = await capturedMutationConfig.mutationFn(update);

    expect(global.fetch).toHaveBeenCalledWith('/api/bookings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });
    expect(result).toEqual(update);
  });

  it('shows a success toast and invalidates caches on success', () => {
    useUpdateBooking();
    capturedMutationConfig.onSuccess();

    expectCacheInvalidation();
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Booking updated', color: 'success' })
    );
  });

  it('shows a danger toast on error', () => {
    useUpdateBooking();
    capturedMutationConfig.onError(new Error('Update rejected'));

    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Update failed',
        description: 'Update rejected',
        color: 'danger',
      })
    );
  });
});

describe('useDeleteBooking', () => {
  it('DELETEs the booking by id', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

    useDeleteBooking();
    await capturedMutationConfig.mutationFn('b1');

    expect(global.fetch).toHaveBeenCalledWith('/api/bookings?id=b1', {
      method: 'DELETE',
    });
  });

  it('throws on failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

    useDeleteBooking();

    await expect(capturedMutationConfig.mutationFn('b1')).rejects.toThrow(
      'Failed to delete booking'
    );
  });

  it('invalidates booking-related caches on success', () => {
    useDeleteBooking();
    capturedMutationConfig.onSuccess();

    expectCacheInvalidation();
  });
});

describe.each([
  ['useCheckInBooking', useCheckInBooking, 'checked-in'],
  ['useCheckOutBooking', useCheckOutBooking, 'checked-out'],
  ['useConfirmBooking', useConfirmBooking, 'confirmed'],
])('%s', (_name, useHook, expectedStatus) => {
  it(`PUTs a status transition to ${expectedStatus}`, async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { _id: 'b1' } }),
    });

    useHook();
    await capturedMutationConfig.mutationFn('b1');

    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('/api/bookings');
    expect(options.method).toBe('PUT');

    const body = JSON.parse(options.body);
    expect(body._id).toBe('b1');
    expect(body.status).toBe(expectedStatus);
  });

  it('throws the API error message on failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Invalid transition' }),
    });

    useHook();

    await expect(capturedMutationConfig.mutationFn('b1')).rejects.toThrow(
      'Invalid transition'
    );
  });

  it('invalidates booking-related caches on success', () => {
    useHook();
    capturedMutationConfig.onSuccess();

    expectCacheInvalidation();
  });
});
