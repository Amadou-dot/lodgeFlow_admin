'use client';

import { SWR_CONFIG } from '@/lib/config';
import type {
  Customer,
  CustomersFilters,
  CustomersResponse,
  CustomerResponse,
  CustomerWithStats,
  CustomerPaginationMeta,
  ApiResponse,
} from '@/types';
import { useMutation } from '@tanstack/react-query';
import useSWR from 'swr';

interface CustomersListResponse {
  customers: Customer[];
  pagination: CustomerPaginationMeta;
}

// Fetcher function for SWR
const fetcher = (url: string): Promise<CustomersListResponse> =>
  fetch(url)
    .then(res => {
      if (!res.ok) {
        throw new Error('Failed to fetch customers');
      }
      return res.json();
    })
    .then((result: CustomersResponse) => {
      // Handle new API response format
      if (result.success) {
        return {
          customers: result.data,
          pagination: {
            currentPage: result.pagination.currentPage,
            totalPages: result.pagination.totalPages,
            totalItems: result.pagination.totalCustomers, // Map to consistent naming
            itemsPerPage: result.pagination.limit, // Map to consistent naming
            hasNextPage: result.pagination.hasNextPage,
            hasPreviousPage: result.pagination.hasPrevPage, // Map to consistent naming
          },
        };
      }
      throw new Error('Failed to fetch customers');
    });

// Fetch customers with filters and pagination using SWR
export const useCustomers = (filters: CustomersFilters = {}) => {
  const params = new URLSearchParams();

  if (filters.page) params.append('page', filters.page.toString());
  if (filters.limit) params.append('limit', filters.limit.toString());
  if (filters.search) params.append('search', filters.search);
  if (filters.sortBy) params.append('sortBy', filters.sortBy);
  if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

  const { data, error, isLoading, mutate } = useSWR<CustomersListResponse>(
    `/api/customers?${params.toString()}`,
    fetcher,
    {
      keepPreviousData: SWR_CONFIG.KEEP_PREVIOUS_DATA,
      revalidateOnFocus: SWR_CONFIG.REVALIDATE_ON_FOCUS,
      dedupingInterval: SWR_CONFIG.DEDUPING_INTERVAL_LONG,
    }
  );

  return {
    data: data?.customers || [],
    pagination: data?.pagination,
    error,
    isLoading,
    mutate,
  };
};

// Fetch single customer
export const useCustomer = (id: string) => {
  const { data, error, isLoading, mutate } = useSWR<CustomerWithStats>(
    id ? `/api/customers/${id}` : null,
    (url: string): Promise<CustomerWithStats> =>
      fetch(url)
        .then(res => {
          if (!res.ok) {
            throw new Error('Failed to fetch customer');
          }
          return res.json();
        })
        .then((result: CustomerResponse) => {
          if (result.success) {
            return result.data;
          }
          throw new Error('Failed to fetch customer');
        }),
    {
      revalidateOnFocus: false,
    }
  );

  return {
    data,
    error,
    isLoading,
    mutate,
  };
};

// Create customer
export const useCreateCustomer = () => {
  return useMutation<Customer, Error, Partial<Customer>>({
    mutationFn: async (customerData: Partial<Customer>): Promise<Customer> => {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(customerData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create customer');
      }

      const result: ApiResponse<Customer> = await response.json();
      if (result.success && result.data) {
        return result.data;
      }
      throw new Error(result.error || 'Failed to create customer');
    },
  });
};

// Update customer
export const useUpdateCustomer = () => {
  return useMutation<Customer, Error, Partial<Customer> & { id: string }>({
    mutationFn: async (
      customerData: Partial<Customer> & { id: string }
    ): Promise<Customer> => {
      const response = await fetch(`/api/customers/${customerData.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(customerData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update customer');
      }

      const result: ApiResponse<Customer> = await response.json();
      if (result.success && result.data) {
        return result.data;
      }
      throw new Error(result.error || 'Failed to update customer');
    },
  });
};

// Delete customer
export const useDeleteCustomer = () => {
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (id: string): Promise<{ success: boolean }> => {
      const response = await fetch(`/api/customers/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete customer');
      }

      const result: ApiResponse<null> = await response.json();
      if (result.success) {
        return { success: true };
      }
      throw new Error(result.error || 'Failed to delete customer');
    },
  });
};

// Lock customer
export const useLockCustomer = () => {
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (id: string): Promise<{ success: boolean }> => {
      const response = await fetch(`/api/customers/${id}/lock`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to lock customer');
      }

      const result: ApiResponse<null> = await response.json();
      if (result.success) {
        return { success: true };
      }
      throw new Error(result.error || 'Failed to lock customer');
    },
  });
};

// Unlock customer
export const useUnlockCustomer = () => {
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (id: string): Promise<{ success: boolean }> => {
      const response = await fetch(`/api/customers/${id}/lock`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to unlock customer');
      }

      const result: ApiResponse<null> = await response.json();
      if (result.success) {
        return { success: true };
      }
      throw new Error(result.error || 'Failed to unlock customer');
    },
  });
};
