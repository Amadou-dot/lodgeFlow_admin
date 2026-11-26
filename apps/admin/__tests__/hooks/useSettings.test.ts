/** @jest-environment ./__tests__/setup/fetch-jsdom.cjs */
import { createElement, type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { SettingsAccessError, useSettings } from '@/hooks/useSettings';
import { settings } from '../setup/settings-fixture';

jest.unmock('swr');

const fetchMock = jest.mocked(global.fetch);

function wrapper({ children }: { children: ReactNode }) {
  return createElement(
    SWRConfig,
    { value: { provider: () => new Map(), shouldRetryOnError: false } },
    children
  );
}

beforeEach(() => fetchMock.mockReset());

test('GET preserves sparse values, virtuals and additive nested fields', async () => {
  const { createdAt, updatedAt, __v, singleton, ...sparse } = settings;
  const legacy = {
    ...sparse,
    breakfastPrice: 12.075,
    depositPercentage: 22.125,
    timezone: 'America/Denver',
    businessHours: { open: '8:30', close: '17:00', daysOpen: ['Monday'] },
    notifications: { ...settings.notifications, futureNotification: true },
    contactInfo: null,
  };
  fetchMock.mockResolvedValue(Response.json({ success: true, data: legacy }));

  const { result } = renderHook(useSettings, { wrapper });
  expect(result.current.isLoading).toBe(true);
  expect(result.current.data).toBeUndefined();

  await waitFor(() => expect(result.current.data).toEqual(legacy));
  expect(result.current.isLoading).toBe(false);
  expect(fetchMock).toHaveBeenCalledWith('/api/settings');
});

test.each([401, 403])('GET reports typed denial on HTTP %s', async status => {
  fetchMock.mockResolvedValue(
    new Response('private provider text', { status })
  );
  const { result } = renderHook(useSettings, { wrapper });
  await waitFor(() =>
    expect(result.current.error).toBeInstanceOf(SettingsAccessError)
  );
  expect(result.current.error?.message).toBe('Failed to fetch settings');
  expect(result.current.data).toBeUndefined();
});

test.each([
  [
    'invalid notification flag',
    () =>
      Response.json({
        success: true,
        data: {
          ...settings,
          notifications: { ...settings.notifications, smsEnabled: 'false' },
        },
        error: 'private detail',
      }),
  ],
  [
    'truthy success marker',
    () =>
      Response.json({
        success: 'yes',
        data: settings,
        error: 'private detail',
      }),
  ],
  ['non-JSON body', () => new Response('private detail')],
])(
  'a refresh with %s reports a safe error and retains the last valid value',
  async (_name, invalidResponse) => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ success: true, data: settings })
    );
    const { result } = renderHook(useSettings, { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(settings));

    fetchMock.mockResolvedValueOnce(invalidResponse());
    await act(async () => {
      await result.current.mutate();
    });
    expect(result.current.error?.message).toBe('Failed to fetch settings');
    expect(result.current.data).toEqual(settings);
  }
);

test('GET retains the specified API failure message', async () => {
  fetchMock.mockResolvedValue(
    Response.json({ success: false, error: 'Settings unavailable' })
  );
  const { result } = renderHook(useSettings, { wrapper });
  await waitFor(() =>
    expect(result.current.error?.message).toBe('Settings unavailable')
  );
  expect(result.current.data).toBeUndefined();
});
