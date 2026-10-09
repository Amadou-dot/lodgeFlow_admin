import type { Customer, CustomersResponse } from '@/types';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState } from 'react';

const PAGE_SIZE = 20;

async function fetchCustomersPage({
  page,
  search,
}: {
  page: number;
  search: string;
}): Promise<CustomersResponse> {
  const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
  const response = await fetch(
    `/api/customers?page=${page}&limit=${PAGE_SIZE}${searchParam}`
  );
  if (!response.ok) throw new Error('Failed to fetch customers');
  const result: CustomersResponse = await response.json();
  if (!result.success) throw new Error('Failed to fetch customers');
  return result;
}

// Search and pagination are one query per search term, so late responses cannot
// replace the visible result for a newer term.
export function useInfiniteCustomers() {
  const [searchTerm, setSearchTerm] = useState('');
  const loadingNextFor = useRef<string | null>(null);
  const query = useInfiniteQuery({
    queryKey: ['customers', searchTerm],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      fetchCustomersPage({ page: pageParam, search: searchTerm }),
    getNextPageParam: lastPage =>
      lastPage.pagination.hasNextPage
        ? lastPage.pagination.currentPage + 1
        : undefined,
    retry: false,
  });

  const customers = useMemo(() => {
    const seen = new Set<string>();
    return (query.data?.pages ?? []).flatMap(page =>
      page.data.filter((customer: Customer) => {
        if (seen.has(customer.id)) return false;
        seen.add(customer.id);
        return true;
      })
    );
  }, [query.data]);

  const searchCustomers = useCallback(
    async (search: string) => {
      const nextSearch = search.trim();
      if (nextSearch === searchTerm && query.isError) {
        await query.refetch();
      } else {
        setSearchTerm(nextSearch);
      }
    },
    [query, searchTerm]
  );

  const onLoadMore = useCallback(() => {
    if (
      !query.hasNextPage ||
      query.isFetching ||
      loadingNextFor.current === searchTerm
    )
      return;
    loadingNextFor.current = searchTerm;
    void query.fetchNextPage().finally(() => {
      if (loadingNextFor.current === searchTerm) loadingNextFor.current = null;
    });
  }, [query, searchTerm]);

  return {
    customers,
    hasMore:
      (!query.isError || query.isFetchNextPageError) &&
      (query.hasNextPage ?? true),
    isLoading: query.isFetching,
    onLoadMore,
    searchCustomers,
    isSearching: Boolean(searchTerm) && query.isFetching,
    searchTerm,
  };
}
