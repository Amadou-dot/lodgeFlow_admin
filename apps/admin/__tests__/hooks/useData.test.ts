/** @jest-environment node */
import {
  useActivities,
  useDurationData,
  useOverview,
  useSalesData,
} from '@/hooks/useData';
import type { DashboardData, SalesData } from '@/types/reporting';

interface QueryConfig {
  queryKey: readonly unknown[];
  queryFn: () => Promise<unknown>;
}

let capturedQueryConfig: QueryConfig | null = null;
const mockFetch = jest.fn<Promise<Response>, Parameters<typeof fetch>>();

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn((config: QueryConfig) => {
    capturedQueryConfig = config;
  }),
}));

function query(): QueryConfig {
  if (!capturedQueryConfig) throw new Error('Query not initialized');
  return capturedQueryConfig;
}

const emptyDashboard: DashboardData = {
  overview: {
    totalBookings: 0,
    totalRevenue: 0,
    totalCabins: 0,
    totalCustomers: 0,
    totalCancellations: 0,
    occupancyRate: 0,
    checkInsToday: 0,
    checkOutsToday: 0,
  },
  recentActivity: [],
  charts: { occupancy: [], revenue: [], durations: [] },
};

function mockDashboard(data: DashboardData) {
  mockFetch.mockResolvedValue(Response.json({ success: true, data }));
}

const firstActivity: DashboardData['recentActivity'][number] = {
  id: 'b1',
  customerName: 'John Doe',
  cabinName: 'Pine',
  status: 'confirmed',
  checkInDate: '2024-03-01T00:00:00.000Z',
  checkOutDate: '2024-03-04T00:00:00.000Z',
  createdAt: '2024-02-25T00:00:00.000Z',
  totalPrice: 100,
};

beforeEach(() => {
  capturedQueryConfig = null;
  jest.clearAllMocks();
  global.fetch = mockFetch;
  mockFetch.mockReset();
});

it.each([
  [useOverview, 'overview', '/api/dashboard', 'Failed to fetch overview data'],
  [useActivities, 'activities', '/api/dashboard', 'Failed to fetch activities'],
  [useSalesData, 'sales', '/api/sales', 'Failed to fetch sales data'],
  [
    useDurationData,
    'durations',
    '/api/dashboard',
    'Failed to fetch duration data',
  ],
] as const)(
  'uses the %s hook key and keeps its HTTP failure message',
  async (hook, key, url, error) => {
    mockFetch.mockResolvedValue(new Response(null, { status: 500 }));

    hook();

    expect(query().queryKey).toEqual([key]);
    await expect(query().queryFn()).rejects.toThrow(error);
    expect(mockFetch).toHaveBeenCalledWith(url);
  }
);

it('derives overview values from the wrapped dashboard', async () => {
  mockDashboard({
    ...emptyDashboard,
    overview: {
      ...emptyDashboard.overview,
      totalBookings: 100,
      totalRevenue: 50000,
      totalCustomers: 50,
      totalCancellations: 5,
    },
  });

  useOverview();

  await expect(query().queryFn()).resolves.toEqual({
    bookings: 100,
    revenue: 50000,
    customers: 50,
    cancellations: 5,
  });
});

it('keeps the legacy cancellation fallback when the field is omitted', async () => {
  const { totalCancellations: _, ...overview } = emptyDashboard.overview;
  mockFetch.mockResolvedValue(
    Response.json({
      success: true,
      data: { ...emptyDashboard, overview },
    })
  );

  useOverview();

  await expect(query().queryFn()).resolves.toEqual({
    bookings: 0,
    revenue: 0,
    customers: 0,
    cancellations: 0,
  });
});

it.each([useOverview, useActivities, useDurationData])(
  '%s rejects a dashboard error envelope from an HTTP 200',
  async hook => {
    mockFetch.mockResolvedValue(
      Response.json({ success: false, error: 'Database error' })
    );

    hook();

    await expect(query().queryFn()).rejects.toThrow('Database error');
  }
);

it('limits recent activity to four rows and keeps singular and plural stay labels', async () => {
  const secondActivity = {
    ...firstActivity,
    id: 'b2',
    customerName: 'Jane Smith',
    status: 'checked-in',
    checkInDate: '2024-03-02T00:00:00.000Z',
    checkOutDate: '2024-03-03T00:00:00.000Z',
  } as const;
  mockDashboard({
    ...emptyDashboard,
    recentActivity: [
      firstActivity,
      secondActivity,
      ...Array.from({ length: 4 }, (_, i) => ({
        ...firstActivity,
        id: `b${i + 3}`,
      })),
    ],
  });

  useActivities();

  await expect(query().queryFn()).resolves.toEqual([
    {
      id: 'b1',
      name: 'John Doe',
      status: 'confirmed',
      stayDuration: '3 nights',
    },
    {
      id: 'b2',
      name: 'Jane Smith',
      status: 'checked-in',
      stayDuration: '1 night',
    },
    {
      id: 'b3',
      name: 'John Doe',
      status: 'confirmed',
      stayDuration: '3 nights',
    },
    {
      id: 'b4',
      name: 'John Doe',
      status: 'confirmed',
      stayDuration: '3 nights',
    },
  ]);
});

it('returns bare sales rows and retains additive fields', async () => {
  const salesData = [
    {
      date: 'Jan 1',
      fullDate: '2024-01-01',
      sales: -12.345,
      bookings: 0,
      channel: 'web',
    },
  ] satisfies (SalesData & { channel: string })[];
  mockFetch.mockResolvedValue(Response.json(salesData));

  useSalesData();

  await expect(query().queryFn()).resolves.toEqual(salesData);
});

it('rejects a sales row with a string amount', async () => {
  mockFetch.mockResolvedValue(
    Response.json([
      { date: 'Jan 1', fullDate: '2024-01-01', sales: '400', bookings: 3 },
    ])
  );

  useSalesData();

  await expect(query().queryFn()).rejects.toThrow('Failed to fetch sales data');
});

it('rejects an unexpected sales envelope', async () => {
  mockFetch.mockResolvedValue(Response.json({ success: true, data: [] }));

  useSalesData();

  await expect(query().queryFn()).rejects.toThrow('Failed to fetch sales data');
});

it('keeps precomputed duration rows and their additive fields', async () => {
  const durations = [
    { name: '1-2 nights', value: 40, color: '#3b82f6', label: 'Short stays' },
  ];
  mockDashboard({
    ...emptyDashboard,
    charts: { ...emptyDashboard.charts, durations },
  });

  useDurationData();

  await expect(query().queryFn()).resolves.toEqual(durations);
});

it('keeps the empty duration fallback when the field is omitted', async () => {
  const { durations: _, ...charts } = emptyDashboard.charts;
  mockFetch.mockResolvedValue(
    Response.json({
      success: true,
      data: { ...emptyDashboard, charts },
    })
  );

  useDurationData();

  await expect(query().queryFn()).resolves.toEqual([]);
});

it('validates the whole dashboard before deriving overview', async () => {
  mockFetch.mockResolvedValue(
    Response.json({
      success: true,
      data: {
        ...emptyDashboard,
        charts: {
          ...emptyDashboard.charts,
          occupancy: [
            {
              date: '2024-03-01',
              occupancyRate: '50',
              totalGuests: 1,
              totalCapacity: 2,
            },
          ],
        },
      },
    })
  );

  useOverview();

  await expect(query().queryFn()).rejects.toThrow(
    'Failed to fetch overview data'
  );
});

it('rejects invalid dates before formatting a recent stay', async () => {
  mockFetch.mockResolvedValue(
    Response.json({
      success: true,
      data: {
        ...emptyDashboard,
        recentActivity: [{ ...firstActivity, checkOutDate: 'invalid-date' }],
      },
    })
  );

  useActivities();

  await expect(query().queryFn()).rejects.toThrow(
    'Failed to fetch activities data'
  );
});

it('rejects an invalid duration number', async () => {
  mockFetch.mockResolvedValue(
    Response.json({
      success: true,
      data: {
        ...emptyDashboard,
        charts: {
          ...emptyDashboard.charts,
          durations: [{ name: '1-2 nights', color: '#3b82f6', value: '40' }],
        },
      },
    })
  );

  useDurationData();

  await expect(query().queryFn()).rejects.toThrow(
    'Failed to fetch duration data'
  );
});

it.each([useOverview, useActivities, useDurationData, useSalesData])(
  '%s rejects malformed JSON',
  async hook => {
    mockFetch.mockResolvedValue(new Response('{'));

    hook();

    await expect(query().queryFn()).rejects.toMatchObject({
      name: 'SyntaxError',
    });
  }
);
