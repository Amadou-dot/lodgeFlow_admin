// Mock @tanstack/react-query before imports
let capturedMutationConfig: any = null;

jest.mock('@tanstack/react-query', () => ({
  useMutation: jest.fn((config: any) => {
    capturedMutationConfig = config;
    return {
      mutate: jest.fn(),
      mutateAsync: jest.fn(),
      isPending: false,
      isError: false,
      isSuccess: false,
      reset: jest.fn(),
    };
  }),
}));

import { useResetSettings, useUpdateSettings } from '@/hooks/useSettings';

beforeEach(() => {
  capturedMutationConfig = null;
  jest.clearAllMocks();
  (global.fetch as jest.Mock) = jest.fn();
});

describe('useUpdateSettings', () => {
  const settings = { minBookingLength: 2, maxBookingLength: 30 };

  it('PUTs the settings payload and returns the updated settings', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: settings }),
    });

    useUpdateSettings();
    const result = await capturedMutationConfig.mutationFn(settings);

    expect(global.fetch).toHaveBeenCalledWith('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    expect(result).toEqual(settings);
  });

  it('throws the API error message on HTTP failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Invalid settings' }),
    });

    useUpdateSettings();

    await expect(capturedMutationConfig.mutationFn(settings)).rejects.toThrow(
      'Invalid settings'
    );
  });

  it('throws when the API reports success:false', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: false, error: 'Not saved' }),
    });

    useUpdateSettings();

    await expect(capturedMutationConfig.mutationFn(settings)).rejects.toThrow(
      'Not saved'
    );
  });
});

describe('useResetSettings', () => {
  it('POSTs to reset and returns the default settings', async () => {
    const defaults = { minBookingLength: 1 };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: defaults }),
    });

    useResetSettings();
    const result = await capturedMutationConfig.mutationFn();

    expect(global.fetch).toHaveBeenCalledWith('/api/settings', {
      method: 'POST',
    });
    expect(result).toEqual(defaults);
  });

  it('throws on HTTP failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

    useResetSettings();

    await expect(capturedMutationConfig.mutationFn()).rejects.toThrow(
      'Failed to reset settings'
    );
  });
});
