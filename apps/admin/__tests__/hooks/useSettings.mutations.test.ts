/** @jest-environment ./__tests__/setup/fetch-jsdom.cjs */
import { createElement, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SWRConfig } from 'swr';
import { useResetSettings, useUpdateSettings } from '@/hooks/useSettings';
import { settings } from '../setup/settings-fixture';

jest.unmock('swr');

const fetchMock = jest.mocked(global.fetch);
let client: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return createElement(
    QueryClientProvider,
    { client },
    createElement(SWRConfig, { value: { provider: () => new Map() } }, children)
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
});

afterEach(() => client.clear());

test('PUT sends only the submitted editable fields and returns valid Settings JSON', async () => {
  const changes = { breakfastPrice: 12.075, depositPercentage: 22.125 };
  const updated = { ...settings, ...changes };
  fetchMock.mockResolvedValue(Response.json({ success: true, data: updated }));
  const { result } = renderHook(useUpdateSettings, { wrapper });

  await act(async () =>
    expect(await result.current.mutateAsync(changes)).toEqual(updated)
  );
  expect(fetchMock).toHaveBeenCalledWith('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changes),
  });
});

test('POST resets without a request body and returns valid default Settings JSON', async () => {
  fetchMock.mockResolvedValue(Response.json({ success: true, data: settings }));
  const { result } = renderHook(useResetSettings, { wrapper });

  await act(async () =>
    expect(await result.current.mutateAsync()).toEqual(settings)
  );
  expect(fetchMock).toHaveBeenCalledWith('/api/settings', { method: 'POST' });
});

test.each([
  [
    'legacy HTTP error',
    () => Response.json({ error: 'Invalid settings' }, { status: 400 }),
    'Invalid settings',
  ],
  [
    'explicit application failure',
    () => Response.json({ success: false, error: 'Not saved' }),
    'Not saved',
  ],
  [
    'malformed success',
    () =>
      Response.json({
        success: true,
        data: {
          ...settings,
          businessHours: { ...settings.businessHours, daysOpen: ['Monday', 2] },
        },
        error: 'private detail',
      }),
    'Failed to update settings',
  ],
  [
    'truthy success marker',
    () =>
      Response.json({ success: 1, data: settings, error: 'private detail' }),
    'Failed to update settings',
  ],
  [
    'non-JSON error',
    () => new Response('private detail', { status: 500 }),
    'Failed to update settings',
  ],
  [
    'success payload with HTTP failure',
    () =>
      Response.json(
        { success: true, data: settings, error: 'private detail' },
        { status: 500 }
      ),
    'Failed to update settings',
  ],
])(
  'PUT rejects a %s with the expected error',
  async (_name, reply, message) => {
    fetchMock.mockResolvedValue(reply());
    const { result } = renderHook(useUpdateSettings, { wrapper });
    await act(async () => {
      await expect(
        result.current.mutateAsync({ minBookingLength: 2 })
      ).rejects.toThrow(message);
    });
  }
);

test.each([
  [
    'HTTP failure',
    () => Response.json({ error: 'private detail' }, { status: 500 }),
    'Failed to reset settings',
  ],
  [
    'explicit application failure',
    () => Response.json({ success: false, error: 'Reset unavailable' }),
    'Reset unavailable',
  ],
  [
    'malformed success',
    () =>
      Response.json({
        success: true,
        data: { ...settings, contactInfo: [] },
        error: 'private detail',
      }),
    'Failed to reset settings',
  ],
  [
    'no result',
    () => new Response('private detail'),
    'Failed to reset settings',
  ],
])(
  'POST rejects a %s with the expected error',
  async (_name, reply, message) => {
    fetchMock.mockResolvedValue(reply());
    const { result } = renderHook(useResetSettings, { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toThrow(message);
    });
  }
);
