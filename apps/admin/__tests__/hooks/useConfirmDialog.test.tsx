import '@testing-library/jest-dom';
import { createElement, type ReactNode } from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

jest.mock('@heroui/modal', () => ({
  Modal: ({
    children,
    isOpen,
    onOpenChange,
  }: {
    children: ReactNode;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
  }) =>
    isOpen
      ? createElement(
          'div',
          {},
          createElement(
            'button',
            { onClick: () => onOpenChange(false) },
            'Dismiss modal'
          ),
          children
        )
      : null,
  ModalContent: ({
    children,
  }: {
    children: (onClose: () => void) => ReactNode;
  }) =>
    createElement(
      'div',
      {},
      children(() => {})
    ),
  ModalHeader: ({ children }: { children: ReactNode }) =>
    createElement('div', {}, children),
  ModalBody: ({ children }: { children: ReactNode }) =>
    createElement('div', {}, children),
  ModalFooter: ({ children }: { children: ReactNode }) =>
    createElement('div', {}, children),
}));
jest.mock('@heroui/button', () => ({
  Button: ({
    children,
    onPress,
    isDisabled,
    isLoading,
  }: {
    children: ReactNode;
    onPress: () => void;
    isDisabled?: boolean;
    isLoading?: boolean;
  }) =>
    createElement(
      'button',
      {
        onClick: onPress,
        disabled: isDisabled || isLoading,
      },
      children
    ),
}));

let dialog: ReturnType<typeof useConfirmDialog>;
function Harness() {
  dialog = useConfirmDialog();
  return createElement(dialog.ConfirmDialog);
}

test('runs confirmation once, leaves a failed action open for retry, then closes on success', async () => {
  let rejectFirst: ((reason: Error) => void) | undefined;
  const onConfirm = jest
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectFirst = reject;
        })
    )
    .mockResolvedValueOnce(undefined);
  render(createElement(Harness));
  act(() =>
    dialog.showConfirm({
      title: 'Reset',
      message: 'Reset settings?',
      onConfirm,
    })
  );

  fireEvent.click(screen.getByText('Confirm'));
  expect(screen.getByText('Processing...')).toBeDisabled();
  fireEvent.click(screen.getByText('Processing...'));
  expect(onConfirm).toHaveBeenCalledTimes(1);

  await act(async () => rejectFirst?.(new Error('Transient error')));
  await waitFor(() => expect(screen.getByText('Confirm')).toBeEnabled());
  expect(screen.getByRole('alert')).toHaveTextContent('Transient error');
  fireEvent.click(screen.getByText('Confirm'));
  await waitFor(() =>
    expect(screen.queryByText('Reset settings?')).not.toBeInTheDocument()
  );
  expect(onConfirm).toHaveBeenCalledTimes(2);
});

test('cancel clears the prior confirmation context', async () => {
  const first = jest.fn();
  const second = jest.fn();
  render(createElement(Harness));
  act(() =>
    dialog.showConfirm({
      title: 'First',
      message: 'First action?',
      onConfirm: first,
    })
  );
  fireEvent.click(screen.getByText('Cancel'));
  expect(screen.queryByText('First action?')).not.toBeInTheDocument();
  act(() =>
    dialog.showConfirm({
      title: 'Second',
      message: 'Second action?',
      onConfirm: second,
    })
  );
  await act(async () => fireEvent.click(screen.getByText('Confirm')));
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);
});
