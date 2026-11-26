'use client';

import useSWR, { useSWRConfig } from 'swr';
import { useMutation } from '@tanstack/react-query';
import type { AppSettings } from '@/types';
import type { UpdateSettingsInput } from '@/lib/validations/settings';
import {
  settingsFailureSchema,
  settingsSuccessResponseSchema,
  settingsUpdateHttpFailureSchema,
} from '@/lib/validations/settings-json';

export class SettingsAccessError extends Error {
  constructor() {
    super('Failed to fetch settings');
    Object.setPrototypeOf(this, SettingsAccessError.prototype);
  }
}

async function readSettingsResponse(
  response: Response,
  action: 'fetch' | 'update' | 'reset'
): Promise<AppSettings> {
  const fallback = `Failed to ${action} settings`;
  if (!response.ok && action !== 'update') throw new Error(fallback);

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error(fallback);
  }

  if (response.ok) {
    const result = settingsSuccessResponseSchema.safeParse(body);
    if (result.success) return result.data.data;
  }

  const failure = response.ok
    ? settingsFailureSchema.safeParse(body)
    : settingsUpdateHttpFailureSchema.safeParse(body);
  throw new Error(failure.success ? failure.data.error : fallback);
}

async function fetchSettings(url: string): Promise<AppSettings> {
  const response = await fetch(url);
  if (response.status === 401 || response.status === 403)
    throw new SettingsAccessError();
  return readSettingsResponse(response, 'fetch');
}

export const useSettings = () => {
  const { data, error, isLoading, mutate } = useSWR<AppSettings, Error>(
    '/api/settings',
    fetchSettings,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000, // Dedupe requests within 30 seconds
    }
  );

  return { data, error, isLoading, mutate };
};

export const useUpdateSettings = () => {
  const { mutate } = useSWRConfig();
  return useMutation({
    mutationFn: async (changes: UpdateSettingsInput): Promise<AppSettings> => {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      return readSettingsResponse(response, 'update');
    },
    onSuccess: () => {
      void mutate('/api/settings').catch(() => {});
    },
  });
};

export const useResetSettings = () => {
  const { mutate } = useSWRConfig();
  return useMutation({
    mutationFn: async (): Promise<AppSettings> => {
      const response = await fetch('/api/settings', { method: 'POST' });
      return readSettingsResponse(response, 'reset');
    },
    onSuccess: () => {
      void mutate('/api/settings').catch(() => {});
    },
  });
};
