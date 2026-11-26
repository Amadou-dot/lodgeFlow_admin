import useSWR from 'swr';

const mockUseSWR = jest.mocked(useSWR);
beforeEach(() => {
  mockUseSWR.mockReset();
  mockUseSWR.mockReturnValue({
    data: undefined,
    error: undefined,
    isLoading: true,
    mutate: jest.fn(),
    isValidating: false,
  });
});

import {
  useBookings,
  useBooking,
  useBookingByEmail,
} from '@/hooks/useBookings';

describe('useBookings', () => {
  it('builds URL with no filters', () => {
    useBookings();

    expect(mockUseSWR.mock.calls[0]?.[0]).toBe('/api/bookings?');
  });

  it('includes page in URL', () => {
    useBookings({ page: 3 });

    expect(mockUseSWR.mock.calls[0]?.[0]).toContain('page=3');
  });

  it('includes limit in URL', () => {
    useBookings({ limit: 20 });

    expect(mockUseSWR.mock.calls[0]?.[0]).toContain('limit=20');
  });

  it('includes status filter in URL', () => {
    useBookings({ status: 'confirmed' });

    expect(mockUseSWR.mock.calls[0]?.[0]).toContain('status=confirmed');
  });

  it('includes search in URL', () => {
    useBookings({ search: 'john' });

    expect(mockUseSWR.mock.calls[0]?.[0]).toContain('search=john');
  });

  it('includes sortBy in URL', () => {
    useBookings({ sortBy: 'totalPrice' });

    expect(mockUseSWR.mock.calls[0]?.[0]).toContain('sortBy=totalPrice');
  });

  it('includes sortOrder in URL', () => {
    useBookings({ sortOrder: 'asc' });

    expect(mockUseSWR.mock.calls[0]?.[0]).toContain('sortOrder=asc');
  });

  it('combines multiple filters', () => {
    useBookings({
      page: 2,
      status: 'confirmed',
      sortBy: 'checkInDate',
      sortOrder: 'desc',
    });

    expect(mockUseSWR.mock.calls[0]?.[0]).toContain('page=2');
    expect(mockUseSWR.mock.calls[0]?.[0]).toContain('status=confirmed');
    expect(mockUseSWR.mock.calls[0]?.[0]).toContain('sortBy=checkInDate');
    expect(mockUseSWR.mock.calls[0]?.[0]).toContain('sortOrder=desc');
  });

  it('returns data, error, isLoading, mutate', () => {
    const result = useBookings();

    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('isLoading');
    expect(result).toHaveProperty('mutate');
  });
});

describe('useBooking', () => {
  it('passes null key when id is empty', () => {
    useBooking('');

    expect(mockUseSWR.mock.calls[0]?.[0]).toBeNull();
  });

  it('builds correct URL with id', () => {
    useBooking('abc123');

    expect(mockUseSWR.mock.calls[0]?.[0]).toBe('/api/bookings/abc123');
  });
});

describe('useBookingByEmail', () => {
  it('passes null key when email is empty', () => {
    useBookingByEmail('');

    expect(mockUseSWR.mock.calls[0]?.[0]).toBeNull();
  });

  it('builds correct URL with encoded email', () => {
    useBookingByEmail('test@example.com');

    expect(mockUseSWR.mock.calls[0]?.[0]).toBe(
      '/api/bookings/by-email?email=test%40example.com'
    );
  });
});
