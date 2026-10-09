import '@testing-library/jest-dom';
import { createElement } from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import SettingsForm from '@/components/SettingsForm';
import type { AppSettings } from '@/types';
import type { useConfirmDialog } from '@/hooks/useConfirmDialog';

type ConfirmOptions = Parameters<
  ReturnType<typeof useConfirmDialog>['showConfirm']
>[0];
const mockUpdate = jest.fn<Promise<AppSettings>, [Partial<AppSettings>]>();
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
  type SectionProps = {
    formData: Partial<AppSettings>;
    onInputChange: (
      field: keyof AppSettings,
      value: AppSettings[keyof AppSettings]
    ) => void;
  };
  return {
    SettingsBookingSection: ({ formData, onInputChange }: SectionProps) =>
      React.createElement(
        'div',
        {},
        React.createElement('input', {
          'aria-label': 'Minimum Booking Length',
          value: formData.minBookingLength,
          onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
            onInputChange('minBookingLength', Number(event.target.value)),
        }),
        React.createElement(
          'span',
          {},
          `Breakfast rate: ${formData.breakfastPrice}`
        ),
        React.createElement(
          'button',
          {
            onClick: () => {
              if (formData.notifications) {
                onInputChange('notifications', { ...formData.notifications });
              }
            },
          },
          'Clone notifications'
        ),
        React.createElement(
          'button',
          {
            onClick: () => {
              if (formData.businessHours) {
                onInputChange('businessHours', {
                  ...formData.businessHours,
                  daysOpen: [...formData.businessHours.daysOpen],
                });
              }
            },
          },
          'Clone hours'
        )
      ),
    SettingsCheckInOutSection: () => null,
    SettingsPricingSection: () => null,
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
  _id: 'settings',
  id: 'settings',
  singleton: 'global',
  fullAddress: '',
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
  businessHours: { open: '09:00', close: '17:00', daysOpen: ['Monday'] },
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

test('nested clones stay clean; refresh preserves edits and save can retry', async () => {
  const onSettingsUpdate = jest.fn();
  const view = render(
    createElement(SettingsForm, { settings, onSettingsUpdate })
  );
  expect(screen.getByText('Save')).toBeDisabled();
  fireEvent.click(screen.getByText('Clone notifications'));
  fireEvent.click(screen.getByText('Clone hours'));
  expect(screen.getByText('Save')).toBeDisabled();

  fireEvent.change(screen.getByLabelText('Minimum Booking Length'), {
    target: { value: '2' },
  });
  expect(screen.getByText('Save')).toBeEnabled();
  const refreshed = { ...settings, breakfastPrice: 3 };
  view.rerender(
    createElement(SettingsForm, { settings: refreshed, onSettingsUpdate })
  );
  expect(screen.getByLabelText('Minimum Booking Length')).toHaveValue('2');
  expect(screen.getByText('Breakfast rate: 3')).toBeInTheDocument();
  expect(screen.getByText('Save')).toBeEnabled();

  mockUpdate.mockRejectedValueOnce(new Error('Network error'));
  fireEvent.click(screen.getByText('Save'));
  await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
  expect(onSettingsUpdate).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('Network error');
  expect(screen.getByText('Save')).toBeEnabled();

  const saved = { ...refreshed, minBookingLength: 2 };
  mockUpdate.mockResolvedValueOnce(saved);
  fireEvent.click(screen.getByText('Save'));
  await waitFor(() => expect(onSettingsUpdate).toHaveBeenCalledTimes(1));
  expect(mockUpdate).toHaveBeenLastCalledWith(saved);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByText('Save')).toBeDisabled();
  view.rerender(
    createElement(SettingsForm, { settings: saved, onSettingsUpdate })
  );
  expect(screen.getByText('Save')).toBeDisabled();

  fireEvent.change(screen.getByLabelText('Minimum Booking Length'), {
    target: { value: '4' },
  });
  fireEvent.click(screen.getByText('Discard'));
  expect(screen.getByLabelText('Minimum Booking Length')).toHaveValue('2');
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
  expect(screen.getByLabelText('Minimum Booking Length')).toHaveValue('3');
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
  expect(screen.getByLabelText('Minimum Booking Length')).toHaveValue('3');
  expect(screen.getByText('Save')).toBeEnabled();
  view.rerender(
    createElement(SettingsForm, {
      settings: { ...settings, minBookingLength: 2 },
      onSettingsUpdate,
    })
  );
  expect(screen.getByLabelText('Minimum Booking Length')).toHaveValue('3');
  expect(screen.getByText('Save')).toBeEnabled();
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
  expect(screen.getByLabelText('Minimum Booking Length')).toHaveValue('1');
  expect(screen.getByText('Save')).toBeEnabled();
  view.rerender(
    createElement(SettingsForm, {
      settings: { ...settings, minBookingLength: 2 },
      onSettingsUpdate,
    })
  );
  expect(screen.getByLabelText('Minimum Booking Length')).toHaveValue('1');
  expect(screen.getByText('Save')).toBeEnabled();
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
  expect(screen.getByLabelText('Minimum Booking Length')).toHaveValue('1');
  expect(screen.getByText('Save')).toBeEnabled();
  view.rerender(
    createElement(SettingsForm, {
      settings: { ...settings, minBookingLength: 3 },
      onSettingsUpdate,
    })
  );
  expect(screen.getByLabelText('Minimum Booking Length')).toHaveValue('1');
  expect(screen.getByText('Save')).toBeEnabled();
});
