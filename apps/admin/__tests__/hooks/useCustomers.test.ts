import useSWR from 'swr';

import { customerJsonFixture } from '../setup/customer-json';

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

import { useCustomers, useCustomer } from '@/hooks/useCustomers';

describe('useCustomers', () => {
  it('builds URL with no filters', () => {
    useCustomers();

    expect(mockUseSWR.mock.calls[0]?.[0]).toBe('/api/customers?');
  });

  it('includes page in URL', () => {
    useCustomers({ page: 2 });

    expect(mockUseSWR.mock.calls[0]?.[0]).toContain('page=2');
  });

  it('includes limit in URL', () => {
    useCustomers({ limit: 25 });

    expect(mockUseSWR.mock.calls[0]?.[0]).toContain('limit=25');
  });

  it('includes search in URL', () => {
    useCustomers({ search: 'john' });

    expect(mockUseSWR.mock.calls[0]?.[0]).toContain('search=john');
  });

  it('includes sortBy in URL', () => {
    useCustomers({ sortBy: 'name' });

    expect(mockUseSWR.mock.calls[0]?.[0]).toContain('sortBy=name');
  });

  it('includes sortOrder in URL', () => {
    useCustomers({ sortOrder: 'asc' });

    expect(mockUseSWR.mock.calls[0]?.[0]).toContain('sortOrder=asc');
  });

  it('combines multiple filters', () => {
    useCustomers({
      page: 3,
      limit: 20,
      search: 'doe',
      sortBy: 'name',
      sortOrder: 'desc',
    });

    expect(mockUseSWR.mock.calls[0]?.[0]).toContain('page=3');
    expect(mockUseSWR.mock.calls[0]?.[0]).toContain('limit=20');
    expect(mockUseSWR.mock.calls[0]?.[0]).toContain('search=doe');
    expect(mockUseSWR.mock.calls[0]?.[0]).toContain('sortBy=name');
    expect(mockUseSWR.mock.calls[0]?.[0]).toContain('sortOrder=desc');
  });

  it('keeps previous data between fetches', () => {
    useCustomers();

    expect(mockUseSWR.mock.calls[0]?.[2]?.keepPreviousData).toBe(true);
  });

  it('disables revalidation on focus', () => {
    useCustomers();

    expect(mockUseSWR.mock.calls[0]?.[2]?.revalidateOnFocus).toBe(false);
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
      { ...customerJsonFixture, id: 'user_1', name: 'John Doe' },
      { ...customerJsonFixture, id: 'user_2', name: 'Jane Doe' },
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
    });

    const result = useCustomers();

    expect(result.data).toEqual(mockCustomers);
    expect(result.pagination).toBeDefined();
    expect(result.pagination?.currentPage).toBe(1);
  });
});

describe('useCustomer', () => {
  it('passes null key when id is empty', () => {
    useCustomer('');

    expect(mockUseSWR.mock.calls[0]?.[0]).toBeNull();
  });

  it('builds correct URL with id', () => {
    useCustomer('user_abc123');

    expect(mockUseSWR.mock.calls[0]?.[0]).toBe('/api/customers/user_abc123');
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

    expect(mockUseSWR.mock.calls[0]?.[2]?.revalidateOnFocus).toBe(false);
  });
});
