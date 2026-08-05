import useSWR from 'swr';

const mockUseSWR = useSWR as jest.MockedFunction<typeof useSWR>;

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

import { useCustomers, useCustomer } from '@/hooks/useCustomers';

describe('useCustomers', () => {
  it('builds URL with no filters', () => {
    useCustomers();

    expect(capturedKey).toBe('/api/customers?');
  });

  it('includes page in URL', () => {
    useCustomers({ page: 2 });

    expect(capturedKey).toContain('page=2');
  });

  it('includes limit in URL', () => {
    useCustomers({ limit: 25 });

    expect(capturedKey).toContain('limit=25');
  });

  it('includes search in URL', () => {
    useCustomers({ search: 'john' });

    expect(capturedKey).toContain('search=john');
  });

  it('includes sortBy in URL', () => {
    useCustomers({ sortBy: 'name' });

    expect(capturedKey).toContain('sortBy=name');
  });

  it('includes sortOrder in URL', () => {
    useCustomers({ sortOrder: 'asc' });

    expect(capturedKey).toContain('sortOrder=asc');
  });

  it('combines multiple filters', () => {
    useCustomers({
      page: 3,
      limit: 20,
      search: 'doe',
      sortBy: 'name',
      sortOrder: 'desc',
    });

    expect(capturedKey).toContain('page=3');
    expect(capturedKey).toContain('limit=20');
    expect(capturedKey).toContain('search=doe');
    expect(capturedKey).toContain('sortBy=name');
    expect(capturedKey).toContain('sortOrder=desc');
  });

  it('keeps previous data between fetches', () => {
    useCustomers();

    expect(capturedConfig?.keepPreviousData).toBe(true);
  });

  it('disables revalidation on focus', () => {
    useCustomers();

    expect(capturedConfig?.revalidateOnFocus).toBe(false);
  });

  it('returns empty array when data is undefined', () => {
    const result = useCustomers();

    expect(result.data).toEqual([]);
  });

  it('returns pagination as undefined when data is undefined', () => {
    const result = useCustomers();

    expect(result.pagination).toBeUndefined();
  });

  it('returns data, pagination, error, isLoading, mutate', () => {
    const result = useCustomers();

    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('pagination');
    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('isLoading');
    expect(result).toHaveProperty('mutate');
  });

  it('returns customers from data when SWR resolves', () => {
    const mockCustomers = [
      { id: 'user_1', name: 'John Doe' },
      { id: 'user_2', name: 'Jane Doe' },
    ];

    mockUseSWR.mockReturnValue({
      data: {
        customers: mockCustomers,
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalItems: 2,
          itemsPerPage: 10,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      },
      error: undefined,
      isLoading: false,
      mutate: jest.fn(),
      isValidating: false,
    } as any);

    const result = useCustomers();

    expect(result.data).toEqual(mockCustomers);
    expect(result.pagination).toBeDefined();
    expect(result.pagination?.currentPage).toBe(1);
  });
});

describe('useCustomer', () => {
  it('passes null key when id is empty', () => {
    useCustomer('');

    expect(capturedKey).toBeNull();
  });

  it('builds correct URL with id', () => {
    useCustomer('user_abc123');

    expect(capturedKey).toBe('/api/customers/user_abc123');
  });

  it('returns data, error, isLoading, mutate', () => {
    const result = useCustomer('user_abc123');

    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('isLoading');
    expect(result).toHaveProperty('mutate');
  });

  it('disables revalidation on focus', () => {
    useCustomer('user_abc123');

    expect(capturedConfig?.revalidateOnFocus).toBe(false);
  });
});
