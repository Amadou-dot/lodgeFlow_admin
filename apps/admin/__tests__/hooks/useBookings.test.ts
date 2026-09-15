import useSWR from 'swr';

const mockUseSWR = useSWR as jest.MockedFunction<typeof useSWR>;

let capturedKey: string | null = null;

beforeEach(() => {
  capturedKey = null;

  mockUseSWR.mockImplementation((key: any, _fetcher: any, _config: any) => {
    capturedKey = key;
    return {
      data: undefined,
      error: undefined,
      isLoading: true,
      mutate: jest.fn(),
      isValidating: false,
    } as any;
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

    expect(capturedKey).toBe('/api/bookings?');
  });

  it('includes page in URL', () => {
    useBookings({ page: 3 });

    expect(capturedKey).toContain('page=3');
  });

  it('includes limit in URL', () => {
    useBookings({ limit: 20 });

    expect(capturedKey).toContain('limit=20');
  });

  it('includes status filter in URL', () => {
    useBookings({ status: 'confirmed' });

    expect(capturedKey).toContain('status=confirmed');
  });

  it('includes search in URL', () => {
    useBookings({ search: 'john' });

    expect(capturedKey).toContain('search=john');
  });

  it('includes sortBy in URL', () => {
    useBookings({ sortBy: 'totalPrice' });

    expect(capturedKey).toContain('sortBy=totalPrice');
  });

  it('includes sortOrder in URL', () => {
    useBookings({ sortOrder: 'asc' });

    expect(capturedKey).toContain('sortOrder=asc');
  });

  it('combines multiple filters', () => {
    useBookings({
      page: 2,
      status: 'confirmed',
      sortBy: 'checkInDate',
      sortOrder: 'desc',
    });

    expect(capturedKey).toContain('page=2');
    expect(capturedKey).toContain('status=confirmed');
    expect(capturedKey).toContain('sortBy=checkInDate');
    expect(capturedKey).toContain('sortOrder=desc');
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

    expect(capturedKey).toBeNull();
  });

  it('builds correct URL with id', () => {
    useBooking('abc123');

    expect(capturedKey).toBe('/api/bookings/abc123');
  });
});

describe('useBookingByEmail', () => {
  it('passes null key when email is empty', () => {
    useBookingByEmail('');

    expect(capturedKey).toBeNull();
  });

  it('builds correct URL with encoded email', () => {
    useBookingByEmail('test@example.com');

    expect(capturedKey).toBe('/api/bookings/by-email?email=test%40example.com');
  });
});
