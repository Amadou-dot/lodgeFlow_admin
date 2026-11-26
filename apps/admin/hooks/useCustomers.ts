'use client';

import type {
  CreateCustomerInput,
  UpdateCustomerRequest,
} from '@/lib/validations/customer';

import { SWR_CONFIG } from '@/lib/config';
import { fetchCustomersList } from '@/lib/customer-list';
import { changeCustomerLock } from '@/lib/customer-lock';
import { resourceReadKey } from '@/hooks/resourceReadKey';
import type {
  Customer,
  CustomersFilters,
  CustomerWithStats,
  CustomerPaginationMeta,
} from '@/types';
import type { CustomerJson } from '@/types/customer-json';
import {
  customerDeleteSuccessResponseSchema,
  customerMutationErrorSchema,
  isCustomerDetailSuccessResponse,
  isCustomerMutationSuccessResponse,
} from '@/lib/validations/customer-responses';
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
  fetchCustomersList(url).then(result => ({
    customers: result.data,
    pagination: {
      currentPage: result.pagination.currentPage,
      totalPages: result.pagination.totalPages,
      totalItems: result.pagination.totalCustomers,
      itemsPerPage: result.pagination.limit,
      hasNextPage: result.pagination.hasNextPage,
      hasPreviousPage: result.pagination.hasPrevPage,
    },
  }));

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

async function readCustomerResponseJson(
  response: Response,
  fallback: string
): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error(fallback);
  }
}

function customerMutationError(value: unknown, fallback: string): Error {
  const parsed = customerMutationErrorSchema.safeParse(value);
  return new Error(parsed.success ? parsed.data.error : fallback);
}

async function readCustomerMutation(
  response: Response,
  fallback: string
): Promise<CustomerJson> {
  const result = await readCustomerResponseJson(response, fallback);
  if (response.ok && isCustomerMutationSuccessResponse(result)) {
    return result.data;
  }

  throw customerMutationError(result, fallback);
}

async function fetchCustomer(url: string): Promise<CustomerWithStats> {
  const fallback = 'Failed to fetch customer';
  const response = await fetch(url);
  if (!response.ok) throw new Error(fallback);

  const result = await readCustomerResponseJson(response, fallback);
  if (
    !isCustomerDetailSuccessResponse(result) ||
    result.data.id !== url.slice('/api/customers/'.length)
  )
    throw new Error(fallback);
  return result.data;
}

// Fetch single customer
export const useCustomer = (id: string) => {
  const { data, error, isLoading, mutate } = useSWR<CustomerWithStats>(
    id ? `/api/customers/${id}` : null,
    fetchCustomer,
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
  return useMutation<CustomerJson, Error, CreateCustomerInput>({
    mutationFn: async (
      customerData: CreateCustomerInput
    ): Promise<CustomerJson> => {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(customerData),
      });

      return readCustomerMutation(response, 'Failed to create customer');
    },
    onSuccess: () => refreshCustomerCaches({ dashboard: 'overview' }),
  });
};

// Update customer
export const useUpdateCustomer = () => {
  const refreshCustomerCaches = useRefreshCustomerCaches();
  return useMutation<
    CustomerJson,
    Error,
    UpdateCustomerRequest & { id: string }
  >({
    mutationFn: async (
      customerData: UpdateCustomerRequest & { id: string }
    ): Promise<CustomerJson> => {
      const response = await fetch(`/api/customers/${customerData.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(customerData),
      });

      const fallback = 'Failed to update customer';
      const saved = await readCustomerMutation(response, fallback);
      if (saved.id !== customerData.id) throw new Error(fallback);
      return saved;
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
  return useMutation<{ success: true }, Error, string>({
    mutationFn: async (id: string): Promise<{ success: true }> => {
      const response = await fetch(`/api/customers/${id}`, {
        method: 'DELETE',
      });

      const fallback = 'Failed to delete customer';
      const result = await readCustomerResponseJson(response, fallback);
      if (
        response.ok &&
        customerDeleteSuccessResponseSchema.safeParse(result).success
      ) {
        return { success: true };
      }
      throw customerMutationError(result, fallback);
    },
    onSuccess: () => refreshCustomerCaches({ dashboard: 'both' }),
  });
};

// Lock customer
export const useLockCustomer = () => {
  const refreshCustomerCaches = useRefreshCustomerCaches();
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: (id: string) => changeCustomerLock({ id, action: 'lock' }),
    onSuccess: () => refreshCustomerCaches(),
  });
};

// Unlock customer
export const useUnlockCustomer = () => {
  const refreshCustomerCaches = useRefreshCustomerCaches();
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: (id: string) => changeCustomerLock({ id, action: 'unlock' }),
    onSuccess: () => refreshCustomerCaches(),
  });
};
