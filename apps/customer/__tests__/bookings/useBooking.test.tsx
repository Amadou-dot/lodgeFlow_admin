import type {
  ApiResponse,
  CancellationResponse,
  RefundEstimateResponse,
} from '@/types';
import type { BookingHistoryItem, BookingDetail } from '@/types/booking-read';
import { renderHook, waitFor } from '@testing-library/react';
import {
  useCreateBooking,
  useBookingHistory,
  useBookingById,
  useUpdateBooking,
  useCancelBooking,
  useRefundEstimate,
} from '@/hooks/useBooking';
import { createTestQueryClient } from '@/__tests__/shared/test-utils';
import { QueryClientProvider } from '@tanstack/react-query';

function historyBooking({
  id,
  status,
}: {
  id: string;
  status: BookingHistoryItem['status'];
}): BookingHistoryItem {
  return {
    _id: id,
    customer: 'user_customer',
    cabin: null,
    checkInDate: '2030-01-01T00:00:00.000Z',
    checkOutDate: '2030-01-03T00:00:00.000Z',
    numNights: 2,
    numGuests: 2,
    status,
    cabinPrice: 200,
    totalPrice: 200,
  };
}

// Create wrapper for hooks
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={createTestQueryClient()}>
    {children}
  </QueryClientProvider>
);

describe('useCreateBooking', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('creates a booking successfully', async () => {
    const mockBooking = {
      ...historyBooking({ id: '1', status: 'unconfirmed' }),
      cabin: null,
      id: '1',
    } satisfies BookingDetail;

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockBooking, success: true }),
    });

    const queryClient = createTestQueryClient();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useCreateBooking(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    });

    const response = await result.current.mutateAsync({
      cabinId: 'cabin-1',
      checkInDate: '2025-02-01T00:00:00.000Z',
      checkOutDate: '2025-02-05T00:00:00.000Z',
      numGuests: 2,
      observations: 'Test booking',
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cabinId: 'cabin-1',
        checkInDate: '2025-02-01T00:00:00.000Z',
        checkOutDate: '2025-02-05T00:00:00.000Z',
        numGuests: 2,
        observations: 'Test booking',
      }),
    });
    expect(response).toEqual({ data: mockBooking, success: true });
    expect(invalidate.mock.calls).toEqual([
      [{ queryKey: ['bookings'] }],
      [{ queryKey: ['bookings-history'] }],
      [{ queryKey: ['activities'] }],
      [{ queryKey: ['overview'] }],
    ]);
  });

  it('handles booking creation errors', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Failed to create booking' }),
    });

    const queryClient = createTestQueryClient();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useCreateBooking(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    });

    await expect(
      result.current.mutateAsync({
        cabinId: 'cabin-1',
        checkInDate: '2025-02-01T00:00:00.000Z',
        checkOutDate: '2025-02-05T00:00:00.000Z',
        numGuests: 2,
      })
    ).rejects.toThrow('Failed to create booking');
    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe('useBookingHistory', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('fetches booking history without status filter', async () => {
    const mockBookings = [
      historyBooking({ id: '1', status: 'confirmed' }),
      historyBooking({ id: '2', status: 'checked-in' }),
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockBookings }),
    });

    const { result } = renderHook(() => useBookingHistory(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(global.fetch).toHaveBeenCalledWith('/api/bookings/history');
    expect(result.current.data).toEqual(mockBookings);
  });

  it('fetches booking history with status filter', async () => {
    const mockBookings = [historyBooking({ id: '1', status: 'confirmed' })];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockBookings }),
    });

    const { result } = renderHook(() => useBookingHistory('confirmed'), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/bookings/history?status=confirmed'
    );
  });

  it('handles fetch errors', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
    });

    const { result } = renderHook(() => useBookingHistory(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeTruthy();
  });
});

describe('useBookingById', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('fetches a single booking by ID', async () => {
    const mockBooking = {
      ...historyBooking({ id: '1', status: 'confirmed' }),
      cabin: null,
      id: '1',
      durationText: '2 nights',
      paymentStatus: 'unpaid',
    } satisfies BookingDetail;

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockBooking }),
    });

    const { result } = renderHook(() => useBookingById('1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(global.fetch).toHaveBeenCalledWith('/api/bookings/1');
    expect(result.current.data).toEqual(mockBooking);
  });

  it('does not fetch when bookingId is empty', () => {
    const { result } = renderHook(() => useBookingById(''), { wrapper });

    expect(result.current.data).toBeUndefined();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('handles fetch errors', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
    });

    const { result } = renderHook(() => useBookingById('1'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateBooking', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('updates a booking successfully', async () => {
    const mockUpdatedBooking = {
      ...historyBooking({ id: '1', status: 'unconfirmed' }),
      cabin: null,
      id: '1',
      numGuests: 3,
    } satisfies BookingDetail;

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockUpdatedBooking }),
    });

    const queryClient = createTestQueryClient();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateBooking(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    });

    const response = await result.current.mutateAsync({
      bookingId: '1',
      updates: { numGuests: 3 },
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/bookings/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numGuests: 3 }),
    });
    expect(response).toEqual({ data: mockUpdatedBooking });
    expect(invalidate.mock.calls).toEqual([
      [{ queryKey: ['booking', '1'] }],
      [{ queryKey: ['bookings-history'] }],
    ]);
  });

  it('handles update errors with error message', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Booking not found' }),
    });

    const queryClient = createTestQueryClient();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateBooking(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    });

    await expect(
      result.current.mutateAsync({
        bookingId: '1',
        updates: { numGuests: 3 },
      })
    ).rejects.toThrow('Booking not found');
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('handles update errors without error message', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });

    const queryClient = createTestQueryClient();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateBooking(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    });

    await expect(
      result.current.mutateAsync({
        bookingId: '1',
        updates: { numGuests: 3 },
      })
    ).rejects.toThrow('Failed to update booking');
    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe('useCancelBooking', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('cancels a booking successfully', async () => {
    const mockResponse = {
      success: true,
      message: 'Booking cancelled successfully',
      data: {
        booking: {
          ...historyBooking({ id: '1', status: 'cancelled' }),
          cabin: null,
          id: '1',
        },
        refund: {
          amount: 75,
          type: 'full',
          status: 'pending',
          reason: 'Full refund - cancelled 5 or more days before check-in',
        },
      },
    } satisfies ApiResponse<CancellationResponse>;

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const queryClient = createTestQueryClient();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useCancelBooking(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    });

    const response = await result.current.mutateAsync({ bookingId: '1' });
    expect(response).toEqual(mockResponse);
    expect(invalidate.mock.calls).toEqual([
      [{ queryKey: ['bookings-history'] }],
      [{ queryKey: ['bookings'] }],
      [{ queryKey: ['refund-estimate', '1'] }],
    ]);

    expect(global.fetch).toHaveBeenCalledWith('/api/bookings/1', {
      body: JSON.stringify({ reason: undefined }),
      headers: { 'Content-Type': 'application/json' },
      method: 'DELETE',
    });
  });

  it('handles cancellation errors with error message', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Cannot cancel confirmed booking' }),
    });

    const { result } = renderHook(() => useCancelBooking(), { wrapper });

    await expect(
      result.current.mutateAsync({ bookingId: '1' })
    ).rejects.toThrow('Cannot cancel confirmed booking');
  });

  it('handles cancellation errors without error message', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });

    const { result } = renderHook(() => useCancelBooking(), { wrapper });

    await expect(
      result.current.mutateAsync({ bookingId: '1' })
    ).rejects.toThrow('Failed to cancel booking');
  });
});

describe('useRefundEstimate', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns JSON deadline strings and nulls without claiming document dates', async () => {
    const estimate = {
      estimate: {
        refundPercentage: 100,
        refundAmount: 75,
        refundType: 'full',
        reason: 'Full refund',
        daysUntilCheckIn: 14,
        policy: 'flexible',
      },
      deadlines: {
        fullRefundDeadline: '2030-01-01T00:00:00.000Z',
        partialRefundDeadline: null,
        partialRefundPercentage: 0,
        policy: 'flexible',
      },
      policyDescription: 'Full refund up to 24 hours before check-in',
      canCancel: true,
    } satisfies RefundEstimateResponse;
    const response = {
      success: true,
      data: estimate,
    } satisfies ApiResponse<RefundEstimateResponse>;
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => response,
    });
    const { result } = renderHook(() => useRefundEstimate('1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(estimate);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/bookings/1/refund-estimate'
    );
  });

  it('does not fetch without a booking ID', () => {
    const { result } = renderHook(() => useRefundEstimate(''), { wrapper });
    expect(result.current.data).toBeUndefined();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('reports a 404 without returning a cancellable estimate', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ success: false, error: 'Booking not found' }),
    });
    const { result } = renderHook(() => useRefundEstimate('1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe(
      'Failed to fetch refund estimate'
    );
    expect(result.current.data).toBeUndefined();
  });
});
