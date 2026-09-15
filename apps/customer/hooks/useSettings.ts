import { useQuery } from '@tanstack/react-query';
import type { ApiResponse, Settings } from '@/types';

const fetchSettings = async (): Promise<Settings> => {
  const response = await fetch('/api/settings');

  if (!response.ok) {
    throw new Error('Failed to fetch settings');
  }

  const result: ApiResponse<Settings> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch settings');
  }
  return result.data;
};

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
    staleTime: 1000 * 60 * 15, // 15 minutes — settings change rarely
    gcTime: 1000 * 60 * 30,
  });
}
