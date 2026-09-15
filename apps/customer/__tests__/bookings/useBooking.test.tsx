import { renderHook, waitFor } from '@testing-library/react';
import {
  useCreateBooking,
  useBookingHistory,
  useBookingById,
  useUpdateBooking,
  useCancelBooking,
} from '@/hooks/useBooking';
import { createTestQueryClient } from '@/__tests__/shared/test-utils';
import { QueryClientProvider } from '@tanstack/react-query';

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
      _id: '1',
      cabinId: 'cabin-1',
      userId: 'user-1',
      startDate: '2025-02-01',
      endDate: '2025-02-05',
      totalPrice: 1000,
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockBooking, success: true }),
    });

    const { result } = renderHook(() => useCreateBooking(), { wrapper });

    await result.current.mutateAsync({
      cabinId: 'cabin-1',
      startDate: '2025-02-01',
      endDate: '2025-02-05',
      numGuests: 2,
      observations: 'Test booking',
    } as any);

    expect(global.fetch).toHaveBeenCalledWith('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: expect.any(String),
    });
  });

  it('handles booking creation errors', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Failed to create booking' }),
    });

    const { result } = renderHook(() => useCreateBooking(), { wrapper });

    await expect(
      result.current.mutateAsync({
        cabinId: 'cabin-1',
        startDate: '2025-02-01',
        endDate: '2025-02-05',
      } as any)
    ).rejects.toThrow('Failed to create booking');
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
      { _id: '1', cabinId: 'cabin-1', status: 'confirmed' },
      { _id: '2', cabinId: 'cabin-2', status: 'checked-in' },
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
    const mockBookings = [
      { _id: '1', cabinId: 'cabin-1', status: 'confirmed' },
    ];

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
    const mockBooking = { _id: '1', cabinId: 'cabin-1', status: 'confirmed' };

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
      _id: '1',
      status: 'checked-in',
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockUpdatedBooking }),
    });

    const { result } = renderHook(() => useUpdateBooking(), { wrapper });

    await result.current.mutateAsync({
      bookingId: '1',
      updates: { status: 'checked-in' },
    } as any);

    expect(global.fetch).toHaveBeenCalledWith('/api/bookings/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'checked-in' }),
    });
  });

  it('handles update errors with error message', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Booking not found' }),
    });

    const { result } = renderHook(() => useUpdateBooking(), { wrapper });

    await expect(
      result.current.mutateAsync({
        bookingId: '1',
        updates: { status: 'checked-in' },
      } as any)
    ).rejects.toThrow('Booking not found');
  });

  it('handles update errors without error message', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });

    const { result } = renderHook(() => useUpdateBooking(), { wrapper });

    await expect(
      result.current.mutateAsync({
        bookingId: '1',
        updates: { status: 'checked-in' },
      } as any)
    ).rejects.toThrow('Failed to update booking');
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
    const mockResponse = { data: { _id: '1', status: 'cancelled' } };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => useCancelBooking(), { wrapper });

    await result.current.mutateAsync({ bookingId: '1' });

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
