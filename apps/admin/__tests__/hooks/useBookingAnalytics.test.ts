// Mock @tanstack/react-query before imports
let capturedQueryConfig: any = null;

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn((config: any) => {
    capturedQueryConfig = config;
    return {
      data: undefined,
      error: undefined,
      isLoading: true,
      isFetching: false,
      refetch: jest.fn(),
    };
  }),
}));

beforeEach(() => {
  capturedQueryConfig = null;
  jest.clearAllMocks();
  (global.fetch as jest.Mock) = jest.fn();
});

import {
  useBookingAnalytics,
  type AnalyticsPeriod,
} from '@/hooks/useBookingAnalytics';

describe('useBookingAnalytics', () => {
  it('uses booking-analytics query key with period', () => {
    useBookingAnalytics('7d');

    expect(capturedQueryConfig.queryKey).toEqual(['booking-analytics', '7d']);
  });

  it('defaults to 30d period', () => {
    useBookingAnalytics();

    expect(capturedQueryConfig.queryKey).toEqual(['booking-analytics', '30d']);
  });

  it('fetches with correct period parameter', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: {} }),
    });

    useBookingAnalytics('90d');
    await capturedQueryConfig.queryFn();

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/bookings/analytics?period=90d'
    );
  });

  it('supports all period values', () => {
    const periods: AnalyticsPeriod[] = ['7d', '30d', '90d', '1y', 'all'];

    for (const period of periods) {
      useBookingAnalytics(period);
      expect(capturedQueryConfig.queryKey).toEqual([
        'booking-analytics',
        period,
      ]);
    }
  });

  it('returns analytics data from success response', async () => {
    const mockData = {
      summary: {
        totalRevenue: 50000,
        totalBookings: 100,
        avgBookingValue: 500,
        cancellationRate: 5,
      },
      revenueOverTime: [{ date: '2024-01-01', revenue: 1000, bookings: 2 }],
      statusDistribution: [{ status: 'confirmed', count: 80 }],
      popularCabins: [{ name: 'Lake Cabin', bookingCount: 20, revenue: 10000 }],
      demographics: {
        avgPartySize: 2.5,
        avgStayLength: 3.2,
        extras: {
          breakfast: { count: 50, rate: 0.5 },
          pets: { count: 10, rate: 0.1 },
          parking: { count: 30, rate: 0.3 },
          earlyCheckIn: { count: 15, rate: 0.15 },
          lateCheckOut: { count: 20, rate: 0.2 },
        },
      },
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockData }),
    });

    useBookingAnalytics();
    const result = await capturedQueryConfig.queryFn();

    expect(result).toEqual(mockData);
  });

  it('throws on non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

    useBookingAnalytics();

    await expect(capturedQueryConfig.queryFn()).rejects.toThrow(
      'Failed to fetch booking analytics'
    );
  });
});
