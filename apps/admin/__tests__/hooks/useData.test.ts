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
  useOverview,
  useActivities,
  useSalesData,
  useDurationData,
} from '@/hooks/useData';

describe('useOverview', () => {
  it('uses overview query key', () => {
    useOverview();

    expect(capturedQueryConfig.queryKey).toEqual(['overview']);
  });

  it('fetches from /api/dashboard', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            overview: {
              totalBookings: 100,
              totalRevenue: 50000,
              totalCustomers: 50,
              totalCancellations: 5,
            },
          },
        }),
    });

    useOverview();
    const result = await capturedQueryConfig.queryFn();

    expect(global.fetch).toHaveBeenCalledWith('/api/dashboard');
    expect(result).toEqual({
      bookings: 100,
      revenue: 50000,
      customers: 50,
      cancellations: 5,
    });
  });

  it('defaults cancellations to 0 when not provided', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            overview: {
              totalBookings: 50,
              totalRevenue: 25000,
              totalCustomers: 30,
            },
          },
        }),
    });

    useOverview();
    const result = await capturedQueryConfig.queryFn();

    expect(result.cancellations).toBe(0);
  });

  it('throws on non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

    useOverview();

    await expect(capturedQueryConfig.queryFn()).rejects.toThrow(
      'Failed to fetch overview data'
    );
  });

  it('throws on unsuccessful result', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: false,
          error: 'Database error',
        }),
    });

    useOverview();

    await expect(capturedQueryConfig.queryFn()).rejects.toThrow(
      'Database error'
    );
  });
});

describe('useActivities', () => {
  it('uses activities query key', () => {
    useActivities();

    expect(capturedQueryConfig.queryKey).toEqual(['activities']);
  });

  it('returns formatted activities from dashboard data', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            recentActivity: [
              {
                id: 'b1',
                customerName: 'John Doe',
                status: 'confirmed',
                checkInDate: '2024-03-01',
                checkOutDate: '2024-03-04',
              },
              {
                id: 'b2',
                customerName: 'Jane Smith',
                status: 'checked-in',
                checkInDate: '2024-03-02',
                checkOutDate: '2024-03-03',
              },
            ],
          },
        }),
    });

    useActivities();
    const result = await capturedQueryConfig.queryFn();

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: 'b1',
      name: 'John Doe',
      status: 'confirmed',
      stayDuration: '3 nights',
    });
    expect(result[1]).toEqual({
      id: 'b2',
      name: 'Jane Smith',
      status: 'checked-in',
      stayDuration: '1 night',
    });
  });

  it('limits to 4 activities', async () => {
    const activities = Array.from({ length: 6 }, (_, i) => ({
      id: `b${i}`,
      customerName: `Guest ${i}`,
      status: 'confirmed',
      checkInDate: '2024-03-01',
      checkOutDate: '2024-03-03',
    }));

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: { recentActivity: activities },
        }),
    });

    useActivities();
    const result = await capturedQueryConfig.queryFn();

    expect(result).toHaveLength(4);
  });

  it('throws on non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

    useActivities();

    await expect(capturedQueryConfig.queryFn()).rejects.toThrow(
      'Failed to fetch activities'
    );
  });
});

describe('useSalesData', () => {
  it('uses sales query key', () => {
    useSalesData();

    expect(capturedQueryConfig.queryKey).toEqual(['sales']);
  });

  it('fetches from /api/sales', async () => {
    const mockSalesData = [
      { date: '2024-01', revenue: 5000 },
      { date: '2024-02', revenue: 6000 },
    ];
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSalesData),
    });

    useSalesData();
    const result = await capturedQueryConfig.queryFn();

    expect(global.fetch).toHaveBeenCalledWith('/api/sales');
    expect(result).toEqual(mockSalesData);
  });

  it('throws on non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

    useSalesData();

    await expect(capturedQueryConfig.queryFn()).rejects.toThrow(
      'Failed to fetch sales data'
    );
  });
});

describe('useDurationData', () => {
  it('uses durations query key', () => {
    useDurationData();

    expect(capturedQueryConfig.queryKey).toEqual(['durations']);
  });

  it('fetches duration data from dashboard API', async () => {
    const mockDurations = [
      { range: '1-3 nights', count: 40 },
      { range: '4-7 nights', count: 30 },
    ];
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            charts: { durations: mockDurations },
          },
        }),
    });

    useDurationData();
    const result = await capturedQueryConfig.queryFn();

    expect(result).toEqual(mockDurations);
  });

  it('returns empty array when durations not in response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: { charts: {} },
        }),
    });

    useDurationData();
    const result = await capturedQueryConfig.queryFn();

    expect(result).toEqual([]);
  });

  it('throws on non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

    useDurationData();

    await expect(capturedQueryConfig.queryFn()).rejects.toThrow(
      'Failed to fetch duration data'
    );
  });
});
