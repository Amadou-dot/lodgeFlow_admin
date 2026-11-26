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
import SettingsForm from '@/components/SettingsForm';
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
const mockShowConfirm = jest.fn<void, [ConfirmOptions]>();

jest.mock('@/hooks/useSettings', () => ({
  useUpdateSettings: () => ({ mutateAsync: mockUpdate, isPending: false }),
  useResetSettings: () => ({ mutateAsync: mockReset, isPending: false }),
}));
jest.mock('@/hooks/useConfirmDialog', () => ({
  useConfirmDialog: () => ({
    showConfirm: mockShowConfirm,
    ConfirmDialog: () => null,
  }),
}));
jest.mock('@/components/SettingsForm/index', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    SettingsBookingSection: jest.requireActual<
      typeof import('@/components/SettingsForm/SettingsBookingSection')
    >('@/components/SettingsForm/SettingsBookingSection').default,
    SettingsCheckInOutSection: () => null,
    SettingsPricingSection: jest.requireActual<
      typeof import('@/components/SettingsForm/SettingsPricingSection')
    >('@/components/SettingsForm/SettingsPricingSection').default,
    SettingsAmenitiesSection: () => null,
    SettingsActionsSection: ({
      hasChanges,
      onSave,
      onDiscard,
      onReset,
    }: {
      hasChanges: boolean;
      onSave: () => void;
      onDiscard: () => void;
      onReset: () => void;
    }) =>
      React.createElement(
        'div',
        {},
        React.createElement(
          'button',
          { onClick: onSave, disabled: !hasChanges },
          'Save'
        ),
        React.createElement('button', { onClick: onDiscard }, 'Discard'),
        React.createElement('button', { onClick: onReset }, 'Reset')
      ),
  };
});

const settings: AppSettings = {
  _id: '66ecbf94495f2679035c9687',
  id: '66ecbf94495f2679035c9687',
  singleton: 'global',
  fullAddress: '',
  createdAt: '2026-09-11T12:00:00.000Z',
  updatedAt: '2026-09-12T12:00:00.000Z',
  __v: 2,
  minBookingLength: 1,
  maxBookingLength: 30,
  maxGuestsPerBooking: 8,
  breakfastPrice: 2,
  checkInTime: '15:00',
  checkOutTime: '11:00',
  cancellationPolicy: 'moderate',
  requireDeposit: true,
  depositPercentage: 50,
  allowPets: true,
  petFee: 2,
  smokingAllowed: false,
  earlyCheckInFee: 3,
  lateCheckOutFee: 4,
  wifiIncluded: true,
  parkingIncluded: false,
  parkingFee: 1,
  currency: 'EUR',
  timezone: 'UTC',
  businessHours: { open: '09:00', close: '17:00', daysOpen: ['monday'] },
  notifications: {
    emailEnabled: true,
    smsEnabled: false,
    bookingConfirmation: true,
    paymentReminders: true,
    checkInReminders: true,
  },
};

beforeEach(() => {
  mockUpdate.mockReset();
  mockReset.mockReset();
  mockShowConfirm.mockReset();
});

test('saves only the edited breakfast price from a legacy Settings response', async () => {
  // GET can return explicit null for untouched legacy contact information.
  const readSettings: AppSettings = JSON.parse(
    JSON.stringify({ ...settings, contactInfo: null })
  );
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
  fireEvent.click(screen.getByText('Save'));

  await waitFor(() => expect(onSettingsUpdate).toHaveBeenCalledTimes(1));
  expect(mockUpdate).toHaveBeenCalledWith({ breakfastPrice: 15 });
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
  expect(screen.getByText('Save')).toBeDisabled();
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
  await user.click(screen.getByText('Save'));

  await waitFor(() => expect(onSettingsUpdate).toHaveBeenCalledTimes(1));
  expect(mockUpdate).toHaveBeenCalledWith({ cancellationPolicy: 'strict' });
  expect(policy).toHaveTextContent('Strict');
});

test('refresh preserves edits; retry and discard use the server response', async () => {
  const onSettingsUpdate = jest.fn();
  const view = render(
    createElement(SettingsForm, { settings, onSettingsUpdate })
  );
  expect(screen.getByText('Save')).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Minimum Booking Length'), {
    target: { value: '2' },
  });
  expect(screen.getByText('Save')).toBeEnabled();
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
  expect(screen.getByText('Save')).toBeEnabled();

  mockUpdate.mockRejectedValueOnce(new Error('Network error'));
  fireEvent.click(screen.getByText('Save'));
  await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
  expect(mockUpdate).toHaveBeenNthCalledWith(1, { minBookingLength: 2 });
  expect(onSettingsUpdate).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('Network error');
  expect(screen.getByText('Save')).toBeEnabled();

  const saved = { ...refreshed, minBookingLength: 2, breakfastPrice: 5 };
  mockUpdate.mockResolvedValueOnce(saved);
  fireEvent.click(screen.getByText('Save'));
  await waitFor(() => expect(onSettingsUpdate).toHaveBeenCalledTimes(1));
  expect(screen.getByLabelText('Breakfast Price')).toHaveValue(5);
  expect(mockUpdate).toHaveBeenNthCalledWith(2, { minBookingLength: 2 });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByText('Save')).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Breakfast Price'), {
    target: { value: '8' },
  });
  fireEvent.click(screen.getByText('Discard'));
  expect(screen.getByLabelText('Breakfast Price')).toHaveValue(5);
  expect(screen.getByText('Save')).toBeDisabled();
  view.rerender(
    createElement(SettingsForm, { settings: saved, onSettingsUpdate })
  );
  expect(screen.getByText('Save')).toBeDisabled();
});

test('failed reset rejects for dialog retry and successful reset adopts defaults', async () => {
  const onSettingsUpdate = jest.fn();
  render(createElement(SettingsForm, { settings, onSettingsUpdate }));
  fireEvent.click(screen.getByText('Reset'));
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
  expect(screen.getByText('Save')).toBeDisabled();
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
  fireEvent.click(screen.getByText('Save'));
  fireEvent.change(screen.getByLabelText('Minimum Booking Length'), {
    target: { value: '3' },
  });
  await act(async () => resolveSave?.({ ...settings, minBookingLength: 2 }));
  expect(screen.getByLabelText('Minimum Booking Length')).toHaveValue(3);
  expect(screen.getByText('Save')).toBeEnabled();
  view.rerender(
    createElement(SettingsForm, {
      settings: { ...settings, minBookingLength: 2 },
      onSettingsUpdate,
    })
  );
  expect(screen.getByLabelText('Minimum Booking Length')).toHaveValue(3);
  expect(screen.getByText('Save')).toBeEnabled();

  mockUpdate.mockResolvedValueOnce({ ...settings, minBookingLength: 3 });
  fireEvent.click(screen.getByText('Save'));
  await waitFor(() => expect(screen.getByText('Save')).toBeDisabled());
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
  fireEvent.click(screen.getByText('Save'));
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
  expect(screen.getByText('Save')).toBeEnabled();
  view.rerender(
    createElement(SettingsForm, {
      settings: { ...settings, minBookingLength: 2 },
      onSettingsUpdate,
    })
  );
  expect(screen.getByLabelText('Minimum Booking Length')).toHaveValue(1);
  expect(screen.getByText('Save')).toBeEnabled();

  mockUpdate.mockResolvedValueOnce(settings);
  fireEvent.click(screen.getByText('Save'));
  await waitFor(() => expect(screen.getByText('Save')).toBeDisabled());
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
  fireEvent.click(screen.getByText('Reset'));
  const confirm = mockShowConfirm.mock.calls[0][0].onConfirm;
  act(() => {
    void confirm();
  });
  fireEvent.change(screen.getByLabelText('Minimum Booking Length'), {
    target: { value: '1' },
  });

  await act(async () => resolveReset?.({ ...settings, minBookingLength: 3 }));
  expect(screen.getByLabelText('Minimum Booking Length')).toHaveValue(1);
  expect(screen.getByText('Save')).toBeEnabled();
  view.rerender(
    createElement(SettingsForm, {
      settings: { ...settings, minBookingLength: 3 },
      onSettingsUpdate,
    })
  );
  expect(screen.getByLabelText('Minimum Booking Length')).toHaveValue(1);
  expect(screen.getByText('Save')).toBeEnabled();

  mockUpdate.mockResolvedValueOnce(settings);
  fireEvent.click(screen.getByText('Save'));
  await waitFor(() => expect(screen.getByText('Save')).toBeDisabled());
  expect(mockUpdate).toHaveBeenCalledWith({ minBookingLength: 1 });
});
