import type { Customer } from '@/types';
import { useCallback, useEffect, useState } from 'react';

// Custom hook for infinite scrolling customers with search support
export function useInfiniteCustomers() {
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const limit = 20; // Items per page

  const loadCustomers = async (currentPage: number, search?: string) => {
    try {
      setIsLoading(true);
      const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
      const response = await fetch(
        `/api/customers?page=${currentPage}&limit=${limit}${searchParam}`
      );
      const result = await response.json();

      if (result.success) {
        const newCustomers = result.data || [];
        setHasMore(result.pagination?.hasNextPage || false);

        if (search) {
          // For search, replace results completely
          if (currentPage === 1) {
            setSearchResults(newCustomers);
          } else {
            setSearchResults(prev => [...prev, ...newCustomers]);
          }
        } else {
          // For normal loading, append to allCustomers
          if (currentPage === 1) {
            setAllCustomers(newCustomers);
          } else {
            // Ensure no duplicates when infinite scrolling
            setAllCustomers(prev => {
              const existingIds = new Set(
                prev.map((customer: Customer) => customer.id)
              );
              const uniqueNewCustomers = newCustomers.filter(
                (customer: Customer) => !existingIds.has(customer.id)
              );
              return [...prev, ...uniqueNewCustomers];
            });
          }
        }
      }
    } catch (error) {
      // Handle error silently for production
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Search customers with debouncing
  const searchCustomers = useCallback(async (search: string) => {
    if (!search.trim()) {
      setIsSearching(false);
      setSearchResults([]);
      setSearchTerm('');
      return;
    }

    setIsSearching(true);
    setSearchTerm(search);
    setPage(1);
    await loadCustomers(1, search);
    setIsSearching(false);
  }, []);

  useEffect(() => {
    loadCustomers(1);
  }, []);

  const onLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadCustomers(nextPage, searchTerm || undefined);
  };

  // Return search results if searching, otherwise return all customers
  const customers = searchTerm ? searchResults : allCustomers;

  return {
    customers,
    hasMore,
    isLoading: isLoading || isSearching,
    onLoadMore,
    searchCustomers,
    isSearching,
    searchTerm,
  };
}
