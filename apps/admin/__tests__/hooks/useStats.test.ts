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

import { useCabinStats } from '@/hooks/useCabinStats';
import { useDiningStats } from '@/hooks/useDiningStats';
import { useExperienceStats } from '@/hooks/useExperienceStats';
import { useBookingStats } from '@/hooks/useBookingStats';

describe('useCabinStats', () => {
  it('uses cabin-stats query key', () => {
    useCabinStats();

    expect(capturedQueryConfig.queryKey).toEqual(['cabin-stats']);
  });

  it('fetches from /api/cabins/stats', async () => {
    const mockStats = {
      totalCabins: 10,
      totalCapacity: 40,
      averagePrice: 250,
      cabinsWithDiscount: 3,
    };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockStats }),
    });

    useCabinStats();
    const result = await capturedQueryConfig.queryFn();

    expect(global.fetch).toHaveBeenCalledWith('/api/cabins/stats');
    expect(result).toEqual(mockStats);
  });

  it('throws on non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

    useCabinStats();

    await expect(capturedQueryConfig.queryFn()).rejects.toThrow(
      'Failed to fetch cabin stats'
    );
  });
});

describe('useDiningStats', () => {
  it('uses dining-stats query key', () => {
    useDiningStats();

    expect(capturedQueryConfig.queryKey).toEqual(['dining-stats']);
  });

  it('fetches from /api/dining/stats', async () => {
    const mockStats = {
      totalItems: 25,
      menuCount: 20,
      experienceCount: 5,
      averagePrice: 18.5,
      availableItems: 22,
    };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockStats }),
    });

    useDiningStats();
    const result = await capturedQueryConfig.queryFn();

    expect(global.fetch).toHaveBeenCalledWith('/api/dining/stats');
    expect(result).toEqual(mockStats);
  });

  it('throws on non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

    useDiningStats();

    await expect(capturedQueryConfig.queryFn()).rejects.toThrow(
      'Failed to fetch dining stats'
    );
  });
});

describe('useExperienceStats', () => {
  it('uses experience-stats query key', () => {
    useExperienceStats();

    expect(capturedQueryConfig.queryKey).toEqual(['experience-stats']);
  });

  it('fetches from /api/experiences/stats', async () => {
    const mockStats = {
      totalExperiences: 8,
      averagePrice: 95,
      popularCount: 3,
      totalCapacity: 120,
    };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockStats }),
    });

    useExperienceStats();
    const result = await capturedQueryConfig.queryFn();

    expect(global.fetch).toHaveBeenCalledWith('/api/experiences/stats');
    expect(result).toEqual(mockStats);
  });

  it('throws on non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

    useExperienceStats();

    await expect(capturedQueryConfig.queryFn()).rejects.toThrow(
      'Failed to fetch experience stats'
    );
  });
});

describe('useBookingStats', () => {
  it('uses booking-stats query key', () => {
    useBookingStats();

    expect(capturedQueryConfig.queryKey).toEqual(['booking-stats']);
  });

  it('fetches from /api/bookings/stats', async () => {
    const mockStats = {
      todayCheckIns: 3,
      todayCheckOuts: 2,
      checkedIn: 15,
      unconfirmed: 5,
    };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockStats }),
    });

    useBookingStats();
    const result = await capturedQueryConfig.queryFn();

    expect(global.fetch).toHaveBeenCalledWith('/api/bookings/stats');
    expect(result).toEqual(mockStats);
  });

  it('throws on non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

    useBookingStats();

    await expect(capturedQueryConfig.queryFn()).rejects.toThrow(
      'Failed to fetch booking stats'
    );
  });
});
