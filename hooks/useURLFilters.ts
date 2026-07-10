'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

// Filter value types that can be stored in URL
type FilterValue = string | number | boolean | undefined;

export interface URLFilterConfig {
  [key: string]: {
    type: 'string' | 'number' | 'boolean';
    defaultValue?: FilterValue;
    validValues?: string[]; // For enum-like validation
  };
}

export interface UseURLFiltersOptions {
  filterConfig: URLFilterConfig;
  basePath?: string; // The base path for the page (e.g., '/bookings')
}

export interface UseURLFiltersReturn<T> {
  filters: T;
  updateFilter: <K extends keyof T>(
    key: K,
    value: T[K],
    addToHistory?: boolean
  ) => void;
  updateFilters: (updates: Partial<T>, addToHistory?: boolean) => void;
  resetFilters: () => void;
  clearFilter: (key: keyof T) => void;
}

/**
 * Custom hook for managing filter state in URL query parameters
 * Provides persistent filter state that survives page refreshes and is shareable
 */
export function useURLFilters<T extends Record<string, FilterValue>>({
  filterConfig,
  basePath,
}: UseURLFiltersOptions): UseURLFiltersReturn<T> {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathName = usePathname();

  // Parse current URL parameters into filter values
  const filters = useMemo(() => {
    const result: Record<string, FilterValue> = {};

    Object.entries(filterConfig).forEach(([key, config]) => {
      const urlValue = searchParams.get(key);

      if (urlValue !== null && urlValue !== '') {
        // Validate against allowed values if specified
        if (config.validValues && !config.validValues.includes(urlValue)) {
          result[key] = config.defaultValue;
          return;
        }

        // Type conversion
        switch (config.type) {
          case 'number': {
            const numValue = parseInt(urlValue, 10);
            result[key] = isNaN(numValue) ? config.defaultValue : numValue;
            break;
          }
          case 'boolean': {
            result[key] = urlValue === 'true';
            break;
          }
          case 'string':
          default: {
            result[key] = urlValue;
            break;
          }
        }
      } else {
        result[key] = config.defaultValue;
      }
    });

    return result as T;
  }, [searchParams, filterConfig]);

  // Helper function to build URL with updated parameters
  const buildURL = useCallback(
    (updates: Partial<T>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (
          value === undefined ||
          value === null ||
          value === '' ||
          (filterConfig[key]?.defaultValue !== undefined &&
            value === filterConfig[key].defaultValue)
        ) {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      });

      const queryString = params.toString();

      const currentPath = basePath || pathName;
      return queryString ? `${currentPath}?${queryString}` : currentPath;
    },
    [searchParams, filterConfig, basePath]
  );

  // Update a single filter
  const updateFilter = useCallback(
    <K extends keyof T>(key: K, value: T[K], addToHistory: boolean = false) => {
      const updates = { [key]: value } as unknown as Partial<T>;
      const newURL = buildURL(updates);

      if (addToHistory) {
        router.push(newURL, { scroll: false });
      } else {
        router.replace(newURL, { scroll: false });
      }
    },
    [router, buildURL]
  );

  // Update multiple filters at once
  const updateFilters = useCallback(
    (updates: Partial<T>, addToHistory: boolean = false) => {
      const newURL = buildURL(updates);

      if (addToHistory) {
        router.push(newURL, { scroll: false });
      } else {
        router.replace(newURL, { scroll: false });
      }
    },
    [router, buildURL]
  );

  // Reset all filters to default values
  const resetFilters = useCallback(() => {
    const defaults: Record<string, FilterValue> = {};
    Object.entries(filterConfig).forEach(([key, config]) => {
      defaults[key] = config.defaultValue;
    });
    const newURL = buildURL(defaults as Partial<T>);
    router.replace(newURL, { scroll: false });
  }, [router, buildURL, filterConfig]);

  // Clear a specific filter (set to default)
  const clearFilter = useCallback(
    (key: keyof T) => {
      const updates = {
        [key]: filterConfig[key as string]?.defaultValue,
      } as unknown as Partial<T>;
      const newURL = buildURL(updates);
      router.replace(newURL, { scroll: false });
    },
    [router, buildURL, filterConfig]
  );

  return {
    filters,
    updateFilter,
    updateFilters,
    resetFilters,
    clearFilter,
  };
}

// Predefined filter configurations for common use cases

export const bookingsFilterConfig: URLFilterConfig = {
  page: { type: 'number', defaultValue: 1 },
  limit: { type: 'number', defaultValue: 10 },
  status: {
    type: 'string',
    defaultValue: undefined,
    validValues: [
      'all',
      'unconfirmed',
      'confirmed',
      'checked-in',
      'checked-out',
      'cancelled',
    ],
  },
  search: { type: 'string', defaultValue: undefined },
  sortBy: {
    type: 'string',
    defaultValue: 'checkInDate',
    validValues: [
      'created_at',
      'checkInDate',
      'totalPrice',
      'guestName',
      'cabinName',
    ],
  },
  sortOrder: {
    type: 'string',
    defaultValue: 'desc',
    validValues: ['asc', 'desc'],
  },
};

export const guestsFilterConfig: URLFilterConfig = {
  page: { type: 'number', defaultValue: 1 },
  limit: { type: 'number', defaultValue: 12 },
  search: { type: 'string', defaultValue: undefined },
  sortBy: {
    type: 'string',
    defaultValue: 'name',
    validValues: ['name', 'created_at'],
  },
  sortOrder: {
    type: 'string',
    defaultValue: 'asc',
    validValues: ['asc', 'desc'],
  },
};
