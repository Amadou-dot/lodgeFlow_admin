import { useQuery } from '@tanstack/react-query';
import type { Settings } from '@/types';
import { settingsResponseSchema } from '@/lib/validations/settings-json';

const fetchSettings = async (): Promise<Settings> => {
  const fallback = 'Failed to fetch settings';
  const response = await fetch('/api/settings');
  if (!response.ok) throw new Error(fallback);

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error(fallback);
  }

  const result = settingsResponseSchema.safeParse(body);
  if (!result.success) throw new Error(fallback);
  if (!result.data.success) throw new Error(result.data.error);
  return result.data.data;
};

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
    staleTime: 1000 * 60 * 15, // 15 minutes — settings change rarely
    gcTime: 1000 * 60 * 30,
  });
}
