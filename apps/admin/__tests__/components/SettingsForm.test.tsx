/** @jest-environment ./__tests__/setup/fetch-jsdom.cjs */
import '@testing-library/jest-dom';
import { createElement } from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.unmock('swr');
import { AuthGuard } from '@/components/AuthGuard';
import { SettingsAccessError } from '@/hooks/useSettings';
import { PERMISSIONS } from '@/lib/permissions';
import SettingsPage from '@/app/(dashboard)/settings/page';
import SettingsForm from '@/components/SettingsForm';
import { settings } from '../setup/settings-fixture';
import type { AppSettings } from '@/types';
import type { useConfirmDialog } from '@/hooks/useConfirmDialog';
import {
  stripSettingsMongoMetadata,
  updateSettingsSchema,
  type UpdateSettingsInput,
} from '@/lib/validations/settings';

type ConfirmOptions = Parameters<
  ReturnType<typeof useConfirmDialog>['showConfirm']
>[0];
const mockUpdate = jest.fn<Promise<AppSettings>, [UpdateSettingsInput]>();
const mockReset = jest.fn<Promise<AppSettings>, []>();
const mockMutation = () => ({ mutateAsync: mockUpdate, isPending: false });
let mockUseUpdate: () => {
  mutateAsync: (changes: UpdateSettingsInput) => Promise<AppSettings>;
  isPending: boolean;
} = mockMutation;
const mockShowConfirm = jest.fn<void, [ConfirmOptions]>();

let mockReadSettings: AppSettings | undefined;
let mockReadError: Error | undefined;
const mockRefresh = jest.fn();
const mockRouter = { replace: jest.fn() };
let mockSessionId: string;
jest.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    userId: 'staff-1',
    orgId: 'org-1',
    sessionId: mockSessionId,
  }),
}));
jest.mock('next/navigation', () => ({
  usePathname: () => '/settings',
  useRouter: () => mockRouter,
}));
jest.mock('@/hooks/useSettings', () => ({
  ...jest.requireActual<typeof import('@/hooks/useSettings')>(
    '@/hooks/useSettings'
  ),
  useSettings: () => ({
    data: mockReadSettings,
    error: mockReadError,
    isLoading: false,
    mutate: mockRefresh,
  }),
  useUpdateSettings: () => mockUseUpdate(),
  useResetSettings: () => ({ mutateAsync: mockReset, isPending: false }),
}));
jest.mock('@/hooks/useConfirmDialog', () => ({
  useConfirmDialog: () => ({
    showConfirm: mockShowConfirm,
    ConfirmDialog: () => null,
  }),
}));

beforeEach(() => {
  mockUpdate.mockReset();
  mockUseUpdate = mockMutation;
  mockReset.mockReset();
  mockShowConfirm.mockReset();
  mockReadSettings = settings;
  mockReadError = undefined;
  mockRefresh.mockReset();
  mockSessionId = 'session-1';
});

test('saves only the edited breakfast price from a legacy Settings response', async () => {
  // GET can return explicit null for untouched legacy contact information.
  const readSettings: AppSettings = { ...settings, contactInfo: null };
  mockUpdate.mockImplementation(async changes => {
    const body: unknown = JSON.parse(JSON.stringify(changes));
    const updated = updateSettingsSchema.parse(
      stripSettingsMongoMetadata(body)
    );
    return {
      ...readSettings,
      breakfastPrice: updated.breakfastPrice ?? readSettings.breakfastPrice,
    };
  });
  const onSettingsUpdate = jest.fn();
  render(
    createElement(SettingsForm, { settings: readSettings, onSettingsUpdate })
  );

  fireEvent.change(screen.getByLabelText('Breakfast Price'), {
    target: { value: '15' },
  });
  fireEvent.click(screen.getByText('Save Changes'));

  await waitFor(() => expect(onSettingsUpdate).toHaveBeenCalledTimes(1));
  expect(mockUpdate).toHaveBeenCalledWith({ breakfastPrice: 15 });
});

test('a malformed PUT success keeps the editable draft for a sparse retry', async () => {
  mockUseUpdate = jest.requireActual<typeof import('@/hooks/useSettings')>(
    '@/hooks/useSettings'
  ).useUpdateSettings;
  const fetchMock = jest.mocked(global.fetch);
  fetchMock.mockReset();
  fetchMock
    .mockResolvedValueOnce(
      Response.json({
        success: true,
        data: { ...settings, breakfastPrice: 30, notifications: [] },
        error: 'private detail',
      })
    )
    .mockResolvedValueOnce(
      Response.json({
        success: true,
        data: { ...settings, breakfastPrice: 12.075 },
      })
    );
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const onSettingsUpdate = jest.fn();
  const view = render(
    <QueryClientProvider client={client}>
      <SettingsForm
        settings={{ ...settings, contactInfo: null }}
        onSettingsUpdate={onSettingsUpdate}
      />
    </QueryClientProvider>
  );
  try {
    const field = screen.getByLabelText('Breakfast Price');
    fireEvent.change(field, { target: { value: '12.075' } });
    fireEvent.click(screen.getByText('Save Changes'));

    expect(
      await screen.findByText('Failed to update settings')
    ).toHaveAttribute('role', 'alert');
    expect(field).toHaveValue(12.075);
    expect(onSettingsUpdate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Save Changes'));
    await waitFor(() => expect(onSettingsUpdate).toHaveBeenCalledTimes(1));

    expect(fetchMock.mock.calls.map(([, init]) => init?.body)).toEqual([
      '{"breakfastPrice":12.075}',
      '{"breakfastPrice":12.075}',
    ]);
    expect(screen.getByText('Save Changes')).toBeDisabled();
  } finally {
    view.unmount();
    client.clear();
    fetchMock.mockReset();
  }
});

test('reselecting the current cancellation policy leaves Save disabled', async () => {
  const user = userEvent.setup();
  render(
    createElement(SettingsForm, { settings, onSettingsUpdate: jest.fn() })
  );
  const policy = screen.getByRole('button', { name: /Cancellation Policy/ });

  await user.click(policy);
  await user.click(await screen.findByRole('option', { name: 'Moderate' }));

  expect(policy).toHaveTextContent('Moderate');
  expect(screen.getByText('Save Changes')).toBeDisabled();
});

test('saves a different cancellation policy as the only change', async () => {
  const user = userEvent.setup();
  const onSettingsUpdate = jest.fn();
  mockUpdate.mockResolvedValueOnce({
    ...settings,
    cancellationPolicy: 'strict',
  });
  render(createElement(SettingsForm, { settings, onSettingsUpdate }));
  const policy = screen.getByRole('button', { name: /Cancellation Policy/ });

  await user.click(policy);
  await user.click(await screen.findByRole('option', { name: 'Strict' }));
  await user.click(screen.getByText('Save Changes'));

  await waitFor(() => expect(onSettingsUpdate).toHaveBeenCalledTimes(1));
  expect(mockUpdate).toHaveBeenCalledWith({ cancellationPolicy: 'strict' });
  expect(policy).toHaveTextContent('Strict');
});

test('refresh preserves edits; retry and discard use the server response', async () => {
  const onSettingsUpdate = jest.fn();
  const view = render(
    createElement(SettingsForm, { settings, onSettingsUpdate })
  );
  expect(screen.getByText('Save Changes')).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Minimum Booking Length'), {
    target: { value: '2' },
  });
  expect(screen.getByText('Save Changes')).toBeEnabled();
  const refreshed = {
    ...settings,
    breakfastPrice: 3,
    notifications: { ...settings.notifications },
    businessHours: {
      ...settings.businessHours,
      daysOpen: [...settings.businessHours.daysOpen],
    },
  };
  view.rerender(
    createElement(SettingsForm, { settings: refreshed, onSettingsUpdate })
  );
  expect(screen.getByLabelText('Minimum Booking Length')).toHaveValue(2);
  expect(screen.getByLabelText('Breakfast Price')).toHaveValue(3);
  expect(screen.getByText('Save Changes')).toBeEnabled();

  mockUpdate.mockRejectedValueOnce(new Error('Network error'));
  fireEvent.click(screen.getByText('Save Changes'));
  await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
  expect(mockUpdate).toHaveBeenNthCalledWith(1, { minBookingLength: 2 });
  expect(onSettingsUpdate).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('Network error');
  expect(screen.getByText('Save Changes')).toBeEnabled();

  const saved = { ...refreshed, minBookingLength: 2, breakfastPrice: 5 };
  mockUpdate.mockResolvedValueOnce(saved);
  fireEvent.click(screen.getByText('Save Changes'));
  await waitFor(() => expect(onSettingsUpdate).toHaveBeenCalledTimes(1));
  expect(screen.getByLabelText('Breakfast Price')).toHaveValue(5);
  expect(mockUpdate).toHaveBeenNthCalledWith(2, { minBookingLength: 2 });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByText('Save Changes')).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Breakfast Price'), {
    target: { value: '8' },
  });
  fireEvent.click(screen.getByText('Discard Changes'));
  expect(screen.getByLabelText('Breakfast Price')).toHaveValue(5);
  expect(screen.getByText('Save Changes')).toBeDisabled();
  view.rerender(
    createElement(SettingsForm, { settings: saved, onSettingsUpdate })
  );
  expect(screen.getByText('Save Changes')).toBeDisabled();
});

test('failed reset rejects for dialog retry and successful reset adopts defaults', async () => {
  const onSettingsUpdate = jest.fn();
  render(createElement(SettingsForm, { settings, onSettingsUpdate }));
  fireEvent.click(screen.getByText('Reset to Defaults'));
  const confirm = mockShowConfirm.mock.calls[0][0].onConfirm;
  mockReset.mockRejectedValueOnce(new Error('Reset rejected'));
  await act(async () => {
    await expect(confirm()).rejects.toThrow('Reset rejected');
  });
  expect(onSettingsUpdate).not.toHaveBeenCalled();

  const defaults = { ...settings, minBookingLength: 3 };
  mockReset.mockResolvedValueOnce(defaults);
  await act(async () => confirm());
  expect(onSettingsUpdate).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Minimum Booking Length')).toHaveValue(3);
  expect(screen.getByText('Save Changes')).toBeDisabled();
});

test('an edit made while save is pending survives the saved response and server refresh', async () => {
  let resolveSave: ((saved: AppSettings) => void) | undefined;
  mockUpdate.mockImplementationOnce(
    () =>
      new Promise<AppSettings>(resolve => {
        resolveSave = resolve;
      })
  );
  const onSettingsUpdate = jest.fn();
  const view = render(
    createElement(SettingsForm, { settings, onSettingsUpdate })
  );
  fireEvent.change(screen.getByLabelText('Minimum Booking Length'), {
    target: { value: '2' },
  });
  fireEvent.click(screen.getByText('Save Changes'));
  fireEvent.change(screen.getByLabelText('Minimum Booking Length'), {
    target: { value: '3' },
  });
  await act(async () => resolveSave?.({ ...settings, minBookingLength: 2 }));
  expect(screen.getByLabelText('Minimum Booking Length')).toHaveValue(3);
  expect(screen.getByText('Save Changes')).toBeEnabled();
  view.rerender(
    createElement(SettingsForm, {
      settings: { ...settings, minBookingLength: 2 },
      onSettingsUpdate,
    })
  );
  expect(screen.getByLabelText('Minimum Booking Length')).toHaveValue(3);
  expect(screen.getByText('Save Changes')).toBeEnabled();

  mockUpdate.mockResolvedValueOnce({ ...settings, minBookingLength: 3 });
  fireEvent.click(screen.getByText('Save Changes'));
  await waitFor(() => expect(screen.getByText('Save Changes')).toBeDisabled());
  expect(mockUpdate).toHaveBeenNthCalledWith(2, { minBookingLength: 3 });
});

test('a pending save preserves a newer edit that reverts to the old server value', async () => {
  let resolveSave: ((saved: AppSettings) => void) | undefined;
  mockUpdate.mockImplementationOnce(
    () =>
      new Promise<AppSettings>(resolve => {
        resolveSave = resolve;
      })
  );
  const onSettingsUpdate = jest.fn();
  const view = render(
    createElement(SettingsForm, { settings, onSettingsUpdate })
  );
  fireEvent.change(screen.getByLabelText('Minimum Booking Length'), {
    target: { value: '2' },
  });
  fireEvent.click(screen.getByText('Save Changes'));
  fireEvent.change(screen.getByLabelText('Minimum Booking Length'), {
    target: { value: '1' },
  });
  view.rerender(
    createElement(SettingsForm, {
      settings: { ...settings },
      onSettingsUpdate,
    })
  );

  await act(async () => resolveSave?.({ ...settings, minBookingLength: 2 }));
  expect(screen.getByLabelText('Minimum Booking Length')).toHaveValue(1);
  expect(screen.getByText('Save Changes')).toBeEnabled();
  view.rerender(
    createElement(SettingsForm, {
      settings: { ...settings, minBookingLength: 2 },
      onSettingsUpdate,
    })
  );
  expect(screen.getByLabelText('Minimum Booking Length')).toHaveValue(1);
  expect(screen.getByText('Save Changes')).toBeEnabled();

  mockUpdate.mockResolvedValueOnce(settings);
  fireEvent.click(screen.getByText('Save Changes'));
  await waitFor(() => expect(screen.getByText('Save Changes')).toBeDisabled());
  expect(mockUpdate).toHaveBeenNthCalledWith(2, { minBookingLength: 1 });
});

test('a pending reset preserves a newer edit that reverts to the old server value', async () => {
  let resolveReset: ((defaults: AppSettings) => void) | undefined;
  mockReset.mockImplementationOnce(
    () =>
      new Promise<AppSettings>(resolve => {
        resolveReset = resolve;
      })
  );
  const onSettingsUpdate = jest.fn();
  const view = render(
    createElement(SettingsForm, { settings, onSettingsUpdate })
  );
  fireEvent.change(screen.getByLabelText('Minimum Booking Length'), {
    target: { value: '2' },
  });
  fireEvent.click(screen.getByText('Reset to Defaults'));
  const confirm = mockShowConfirm.mock.calls[0][0].onConfirm;
  act(() => {
    void confirm();
  });
  fireEvent.change(screen.getByLabelText('Minimum Booking Length'), {
    target: { value: '1' },
  });

  await act(async () => resolveReset?.({ ...settings, minBookingLength: 3 }));
  expect(screen.getByLabelText('Minimum Booking Length')).toHaveValue(1);
  expect(screen.getByText('Save Changes')).toBeEnabled();
  view.rerender(
    createElement(SettingsForm, {
      settings: { ...settings, minBookingLength: 3 },
      onSettingsUpdate,
    })
  );
  expect(screen.getByLabelText('Minimum Booking Length')).toHaveValue(1);
  expect(screen.getByText('Save Changes')).toBeEnabled();

  mockUpdate.mockResolvedValueOnce(settings);
  fireEvent.click(screen.getByText('Save Changes'));
  await waitFor(() => expect(screen.getByText('Save Changes')).toBeDisabled());
  expect(mockUpdate).toHaveBeenCalledWith({ minBookingLength: 1 });
});

test('the Settings page retains the newer draft through a transient refresh error and recovery', async () => {
  let finish: ((value: AppSettings) => void) | undefined;
  mockUpdate.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      })
  );
  const view = render(<SettingsPage />);
  const field = () => screen.getByLabelText('Breakfast Price');
  fireEvent.change(field(), { target: { value: '4' } });
  fireEvent.click(screen.getByText('Save Changes'));
  fireEvent.change(field(), { target: { value: '5' } });
  const saved = { ...settings, breakfastPrice: 4 };
  await act(async () => finish?.(saved));
  expect(mockRefresh).toHaveBeenCalledTimes(1);
  mockReadSettings = undefined;
  mockReadError = new Error('Temporary GET failure');
  view.rerender(<SettingsPage />);
  expect(
    screen.getByText(/Error loading settings: Temporary GET failure/)
  ).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Save Changes' })).toBeNull();
  expect(screen.queryByLabelText('Breakfast Price')).toBeNull();
  mockReadError = undefined;
  mockReadSettings = saved;
  view.rerender(<SettingsPage />);
  expect(field()).toHaveValue(5);
  mockUpdate.mockResolvedValueOnce({ ...saved, breakfastPrice: 5 });
  fireEvent.click(screen.getByText('Save Changes'));
  await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(2));
  expect(mockUpdate).toHaveBeenLastCalledWith({ breakfastPrice: 5 });
});

test('Save and Reset serialize, including a previously opened confirmation', async () => {
  let finish: ((value: AppSettings) => void) | undefined;
  mockUpdate.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      })
  );
  render(<SettingsPage />);
  const reset = screen.getByRole('button', { name: 'Reset to Defaults' });
  const save = screen.getByRole('button', { name: 'Save Changes' });
  fireEvent.click(reset);
  const confirm = mockShowConfirm.mock.calls[0][0].onConfirm;
  fireEvent.change(screen.getByLabelText('Breakfast Price'), {
    target: { value: '16' },
  });
  fireEvent.click(save);
  expect(mockUpdate).toHaveBeenCalledTimes(1);
  mockReset.mockResolvedValueOnce(settings);
  await act(async () => confirm());
  expect(mockReset).not.toHaveBeenCalled();
  expect(reset).toBeDisabled();
  expect(save).toBeDisabled();
  fireEvent.click(reset);
  expect(mockShowConfirm).toHaveBeenCalledTimes(1);
  await act(async () => finish?.({ ...settings, breakfastPrice: 16 }));
  expect(reset).toBeEnabled();
  fireEvent.click(reset);
  mockReset.mockReset().mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      })
  );
  act(() => {
    void mockShowConfirm.mock.calls[1][0].onConfirm();
  });
  fireEvent.change(screen.getByLabelText('Breakfast Price'), {
    target: { value: '4' },
  });
  expect(save).toBeDisabled();
  fireEvent.click(save);
  expect(mockUpdate).toHaveBeenCalledTimes(1);
  await act(async () => finish?.(settings));
  expect(save).toBeEnabled();
  expect(screen.getByLabelText('Breakfast Price')).toHaveValue(4);
});

test('typing and pasting fractions preserves fee and percentage precision while counts stay integral', async () => {
  const user = userEvent.setup();
  render(<SettingsPage />);
  for (const label of [
    'Breakfast Price',
    'Pet Fee',
    'Deposit Percentage',
    'Parking Fee',
    'Early Check-in Fee',
    'Late Check-out Fee',
  ]) {
    const input = screen.getByLabelText(label);
    await user.clear(input);
    if (label === 'Pet Fee') await user.paste('12.075');
    else await user.keyboard('12.075');
    expect(input).toHaveValue(12.075);
  }
  fireEvent.change(screen.getByLabelText('Maximum Guests Per Booking'), {
    target: { value: '3.4' },
  });
  mockUpdate.mockResolvedValueOnce(settings);
  await user.click(screen.getByRole('button', { name: 'Save Changes' }));
  expect(mockUpdate).toHaveBeenCalledWith({
    breakfastPrice: 12.075,
    petFee: 12.075,
    depositPercentage: 12.075,
    parkingFee: 12.075,
    earlyCheckInFee: 12.075,
    lateCheckOutFee: 12.075,
    maxGuestsPerBooking: 3,
  });
});

test('a denied Settings read discards the draft before access recovers', () => {
  const view = render(<SettingsPage />);
  fireEvent.change(screen.getByLabelText('Breakfast Price'), {
    target: { value: '9' },
  });
  mockReadError = new SettingsAccessError();
  view.rerender(<SettingsPage />);
  expect(screen.queryByLabelText('Breakfast Price')).toBeNull();
  mockReadError = undefined;
  view.rerender(<SettingsPage />);
  expect(screen.getByLabelText('Breakfast Price')).toHaveValue(
    settings.breakfastPrice
  );
  expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled();
});

test('a verified replacement staff session starts with server settings after a refresh failure', async () => {
  const staffResponse = {
    ok: true,
    json: async () => ({
      data: { userId: 'staff-1', role: 'admin', permissions: PERMISSIONS },
    }),
  };
  const fetchAccess = jest.fn().mockResolvedValue(staffResponse);
  const originalFetch = global.fetch;
  global.fetch = fetchAccess;
  try {
    const page = () => (
      <AuthGuard>
        <SettingsPage />
      </AuthGuard>
    );
    const view = render(page());
    fireEvent.change(await screen.findByLabelText('Breakfast Price'), {
      target: { value: '9' },
    });
    mockReadError = new Error('Temporary failure');
    view.rerender(page());
    expect(screen.queryByLabelText('Breakfast Price')).toBeNull();
    mockSessionId = 'session-2';
    mockReadError = undefined;
    view.rerender(page());
    expect(screen.getByText('Checking staff access…')).toBeInTheDocument();
    expect(await screen.findByLabelText('Breakfast Price')).toHaveValue(
      settings.breakfastPrice
    );
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled();
  } finally {
    global.fetch = originalFetch;
  }
});
