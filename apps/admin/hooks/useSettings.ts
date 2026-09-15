'use client';

import useSWR from 'swr';
import { useMutation } from '@tanstack/react-query';
import { AppSettings } from '@/types';

// Fetcher function for SWR
const fetcher = (url: string) =>
  fetch(url)
    .then(res => {
      if (!res.ok) {
        throw new Error('Failed to fetch settings');
      }
      return res.json();
    })
    .then(result => {
      // Handle new API response format
      if (result.success) {
        return result.data;
      }
      throw new Error(result.error || 'Failed to fetch settings');
    });

// Fetch app settings using SWR
export const useSettings = () => {
  const { data, error, isLoading, mutate } = useSWR<AppSettings>(
    '/api/settings',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000, // Dedupe requests within 30 seconds
    }
  );

  return {
    data,
    error,
    isLoading,
    mutate, // For manual revalidation
  };
};

// Update settings
export const useUpdateSettings = () => {
  return useMutation({
    mutationFn: async (settings: Partial<AppSettings>) => {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update settings');
      }

      const result = await response.json();
      if (result.success) {
        return result.data;
      }
      throw new Error(result.error || 'Failed to update settings');
    },
  });
};

// Reset settings to defaults
export const useResetSettings = () => {
  return useMutation({
    mutationFn: async (): Promise<AppSettings> => {
      const response = await fetch('/api/settings', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to reset settings');
      }
      const result = await response.json();
      if (result.success) {
        return result.data;
      }
      throw new Error(result.error || 'Failed to reset settings');
    },
  });
};
