/** @jest-environment node */
import type { BookingAnalyticsData } from '@/types/reporting';
interface QueryConfig {
  queryKey: readonly unknown[];
  queryFn: () => Promise<BookingAnalyticsData>;
}
const mockFetch = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
const emptyReport: BookingAnalyticsData = {
  summary: {
    totalRevenue: 0,
    totalBookings: 0,
    avgBookingValue: 0,
    cancellationRate: 0,
  },
  revenueOverTime: [],
  statusDistribution: [],
  popularCabins: [],
  demographics: {
    avgPartySize: 0,
    avgStayLength: 0,
    extras: {
      breakfast: { count: 0, rate: 0 },
      pets: { count: 0, rate: 0 },
      parking: { count: 0, rate: 0 },
      earlyCheckIn: { count: 0, rate: 0 },
      lateCheckOut: { count: 0, rate: 0 },
    },
  },
};
// Mock @tanstack/react-query before imports
let capturedQueryConfig: QueryConfig | null = null;
function query(): QueryConfig {
  if (!capturedQueryConfig) throw new Error('Query not initialized');
  return capturedQueryConfig;
}

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn((config: QueryConfig) => {
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
  global.fetch = mockFetch;
  mockFetch.mockReset();
});

import {
  useBookingAnalytics,
  type AnalyticsPeriod,
} from '@/hooks/useBookingAnalytics';

describe('useBookingAnalytics', () => {
  it('keeps compatibility with a bare analytics response', async () => {
    mockFetch.mockResolvedValue(Response.json(emptyReport));
    useBookingAnalytics();
    expect(await query().queryFn()).toEqual(emptyReport);
  });
  it('rejects an error envelope even when HTTP transport succeeds', async () => {
    mockFetch.mockResolvedValue(
      Response.json({ success: false, error: 'Report unavailable' })
    );
    useBookingAnalytics();
    await expect(query().queryFn()).rejects.toThrow('Report unavailable');
  });
  it('uses booking-analytics query key with period', () => {
    useBookingAnalytics('7d');

    expect(query().queryKey).toEqual(['booking-analytics', '7d']);
  });

  it('defaults to 30d period', () => {
    useBookingAnalytics();

    expect(query().queryKey).toEqual(['booking-analytics', '30d']);
  });

  it('fetches with correct period parameter', async () => {
    mockFetch.mockResolvedValue(
      Response.json({ success: true, data: emptyReport }, { status: 200 })
    );

    useBookingAnalytics('90d');
    await query().queryFn();

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/bookings/analytics?period=90d'
    );
  });

  it('supports all period values', () => {
    const periods: AnalyticsPeriod[] = ['7d', '30d', '90d', '1y', 'all'];

    for (const period of periods) {
      useBookingAnalytics(period);
      expect(query().queryKey).toEqual(['booking-analytics', period]);
    }
  });

  it('returns analytics data from success response', async () => {
    const mockData: BookingAnalyticsData = {
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

    mockFetch.mockResolvedValue(
      Response.json({ success: true, data: mockData }, { status: 200 })
    );

    useBookingAnalytics();
    const result = await query().queryFn();

    expect(result).toEqual(mockData);
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 500 }));

    useBookingAnalytics();

    await expect(query().queryFn()).rejects.toThrow(
      'Failed to fetch booking analytics'
    );
  });
});
