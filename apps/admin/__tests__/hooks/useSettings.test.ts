import useSWR from 'swr';

const mockUseSWR = useSWR as jest.MockedFunction<typeof useSWR>;

// Capture SWR args
let capturedKey: string | null = null;
let capturedConfig: any = null;

beforeEach(() => {
  capturedKey = null;
  capturedConfig = null;

  mockUseSWR.mockImplementation((key: any, _fetcher: any, config: any) => {
    capturedKey = key;
    capturedConfig = config;
    return {
      data: undefined,
      error: undefined,
      isLoading: true,
      mutate: jest.fn(),
      isValidating: false,
    } as any;
  });
});

// Import after mocking
import { useSettings } from '@/hooks/useSettings';

describe('useSettings', () => {
  it('calls useSWR with /api/settings key', () => {
    useSettings();

    expect(capturedKey).toBe('/api/settings');
  });

  it('disables revalidation on focus', () => {
    useSettings();

    expect(capturedConfig?.revalidateOnFocus).toBe(false);
  });

  it('sets deduping interval to 30 seconds', () => {
    useSettings();

    expect(capturedConfig?.dedupingInterval).toBe(30000);
  });

  it('returns data, error, isLoading, and mutate', () => {
    const result = useSettings();

    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('isLoading');
    expect(result).toHaveProperty('mutate');
  });

  it('returns loading state initially', () => {
    const result = useSettings();

    expect(result.isLoading).toBe(true);
    expect(result.data).toBeUndefined();
  });

  it('returns data when SWR resolves', () => {
    mockUseSWR.mockReturnValue({
      data: { minBookingLength: 1, maxBookingLength: 30 },
      error: undefined,
      isLoading: false,
      mutate: jest.fn(),
      isValidating: false,
    } as any);

    const result = useSettings();

    expect(result.isLoading).toBe(false);
    expect(result.data).toEqual({
      minBookingLength: 1,
      maxBookingLength: 30,
    });
  });

  it('returns error when SWR fails', () => {
    const error = new Error('Failed to fetch');
    mockUseSWR.mockReturnValue({
      data: undefined,
      error,
      isLoading: false,
      mutate: jest.fn(),
      isValidating: false,
    } as any);

    const result = useSettings();

    expect(result.error).toBe(error);
  });
});
