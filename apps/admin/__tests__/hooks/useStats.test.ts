/** @jest-environment node */
import { useBookingStats } from '@/hooks/useBookingStats';
import { useCabinStats } from '@/hooks/useCabinStats';
import { useDiningStats } from '@/hooks/useDiningStats';
import { useExperienceStats } from '@/hooks/useExperienceStats';
import type {
  BookingStats,
  CabinStats,
  DiningStats,
  ExperienceStats,
} from '@/types/catalog-stats';

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

beforeEach(() => {
  capturedQueryConfig = null;
  jest.clearAllMocks();
  global.fetch = mockFetch;
  mockFetch.mockReset();
});

describe.each([
  {
    resource: 'cabin',
    url: '/api/cabins/stats',
    hook: useCabinStats,
    stats: {
      totalCabins: 10,
      totalCapacity: 40,
      averagePrice: null,
      cabinsWithDiscount: 3,
      activeCabins: 7,
      inactiveCabins: 2,
      maintenanceCabins: 1,
    } satisfies CabinStats,
    invalid: { activeCabins: '7' },
  },
  {
    resource: 'dining',
    url: '/api/dining/stats',
    hook: useDiningStats,
    stats: {
      totalItems: 25,
      menuCount: 20,
      experienceCount: 5,
      averagePrice: -18.5,
      availableItems: 22,
    } satisfies DiningStats,
    invalid: { availableItems: null },
  },
  {
    resource: 'experience',
    url: '/api/experiences/stats',
    hook: useExperienceStats,
    stats: {
      totalExperiences: 8,
      averagePrice: null,
      popularCount: 3,
      totalCapacity: 0,
    } satisfies ExperienceStats,
    invalid: { totalCapacity: '120' },
  },
  {
    resource: 'booking',
    url: '/api/bookings/stats',
    hook: useBookingStats,
    stats: {
      todayCheckIns: 3,
      todayCheckOuts: 2,
      checkedIn: 15,
      unconfirmed: 0,
    } satisfies BookingStats,
    invalid: { unconfirmed: [] },
  },
])('$resource stats', ({ resource, url, hook, stats, invalid }) => {
  it('keeps its cache key and fetches wrapped stats', async () => {
    const data = { ...stats, collectedAt: '2026-11-25T00:00:00.000Z' };
    mockFetch.mockResolvedValue(Response.json({ success: true, data }));

    hook();

    expect(query().queryKey).toEqual([`${resource}-stats`]);
    await expect(query().queryFn()).resolves.toEqual(data);
    expect(mockFetch).toHaveBeenCalledWith(url);
  });

  it('accepts a legacy raw stats payload', async () => {
    mockFetch.mockResolvedValue(Response.json(stats));

    hook();

    await expect(query().queryFn()).resolves.toEqual(stats);
  });

  it('rejects a malformed wrapped stats payload', async () => {
    mockFetch.mockResolvedValue(
      Response.json({
        success: true,
        data: { ...stats, ...invalid },
      })
    );

    hook();

    await expect(query().queryFn()).rejects.toThrow(
      `Failed to fetch ${resource} stats`
    );
  });

  it('rejects an incomplete raw stats payload', async () => {
    mockFetch.mockResolvedValue(Response.json({ averagePrice: null }));

    hook();

    await expect(query().queryFn()).rejects.toThrow(
      `Failed to fetch ${resource} stats`
    );
  });

  it('rejects an error envelope from an HTTP 200', async () => {
    mockFetch.mockResolvedValue(
      Response.json({
        success: false,
        error: 'Stats unavailable',
      })
    );

    hook();

    await expect(query().queryFn()).rejects.toThrow(
      `Failed to fetch ${resource} stats`
    );
  });

  it('keeps its HTTP failure message', async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 500 }));

    hook();

    await expect(query().queryFn()).rejects.toThrow(
      `Failed to fetch ${resource} stats`
    );
  });

  it('rejects malformed JSON', async () => {
    mockFetch.mockResolvedValue(new Response('{'));

    hook();

    await expect(query().queryFn()).rejects.toMatchObject({
      name: 'SyntaxError',
    });
  });
});
