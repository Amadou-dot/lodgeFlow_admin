'use client';

import type {
  CreateCustomerInput,
  UpdateCustomerRequest,
} from '@/lib/validations/customer';

import { SWR_CONFIG } from '@/lib/config';
import { resourceReadKey } from '@/hooks/resourceReadKey';
import type {
  Customer,
  CustomersFilters,
  CustomersResponse,
  CustomerResponse,
  CustomerWithStats,
  CustomerPaginationMeta,
  ApiResponse,
} from '@/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import useSWR, { useSWRConfig } from 'swr';

const isCustomerReadKey = resourceReadKey('/api/customers');
const isBookingReadKey = resourceReadKey('/api/bookings');
type DashboardRefresh = 'overview' | 'activities' | 'both';
type CustomerRefreshOptions = {
  dashboard?: DashboardRefresh;
  populatedBookings?: boolean;
};

const useRefreshCustomerCaches = () => {
  const queryClient = useQueryClient();
  const { mutate } = useSWRConfig();

  return ({ dashboard, populatedBookings }: CustomerRefreshOptions = {}) => {
    queryClient.invalidateQueries({ queryKey: ['customers'] });
    if (dashboard === 'overview' || dashboard === 'both') {
      queryClient.invalidateQueries({ queryKey: ['overview'] });
    }
    if (dashboard === 'activities' || dashboard === 'both') {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    }
    void mutate(isCustomerReadKey).catch(() => {});
    if (populatedBookings) {
      void mutate(isBookingReadKey).catch(() => {});
    }
  };
};

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
  const refreshCustomerCaches = useRefreshCustomerCaches();
  return useMutation<Customer, Error, CreateCustomerInput>({
    mutationFn: async (
      customerData: CreateCustomerInput
    ): Promise<Customer> => {
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
    onSuccess: () => refreshCustomerCaches({ dashboard: 'overview' }),
  });
};

// Update customer
export const useUpdateCustomer = () => {
  const refreshCustomerCaches = useRefreshCustomerCaches();
  return useMutation<Customer, Error, UpdateCustomerRequest & { id: string }>({
    mutationFn: async (
      customerData: UpdateCustomerRequest & { id: string }
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
    onSuccess: () =>
      refreshCustomerCaches({
        dashboard: 'activities',
        populatedBookings: true,
      }),
  });
};

// Delete customer
export const useDeleteCustomer = () => {
  const refreshCustomerCaches = useRefreshCustomerCaches();
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
    onSuccess: () => refreshCustomerCaches({ dashboard: 'both' }),
  });
};

// Lock customer
export const useLockCustomer = () => {
  const refreshCustomerCaches = useRefreshCustomerCaches();
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
    onSuccess: () => refreshCustomerCaches(),
  });
};

// Unlock customer
export const useUnlockCustomer = () => {
  const refreshCustomerCaches = useRefreshCustomerCaches();
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
    onSuccess: () => refreshCustomerCaches(),
  });
};
