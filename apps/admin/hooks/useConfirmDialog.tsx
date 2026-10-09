import { useRef, useState } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@heroui/modal';
import { Button } from '@heroui/button';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?:
    'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
}

type DialogState =
  | { kind: 'closed' }
  | { kind: 'open'; props: ConfirmDialogProps; error?: string }
  | { kind: 'submitting'; props: ConfirmDialogProps };

export function useConfirmDialog() {
  const [dialog, setDialog] = useState<DialogState>({ kind: 'closed' });
  const submitting = useRef(false);

  const showConfirm = (props: ConfirmDialogProps) => {
    if (!submitting.current) setDialog({ kind: 'open', props });
  };

  const closeDialog = () => {
    if (!submitting.current) setDialog({ kind: 'closed' });
  };

  const handleConfirm = async () => {
    if (dialog.kind !== 'open' || submitting.current) return;
    const props = dialog.props;
    submitting.current = true;
    setDialog({ kind: 'submitting', props });
    try {
      await props.onConfirm();
      setDialog({ kind: 'closed' });
    } catch (error) {
      setDialog({
        kind: 'open',
        props,
        error:
          error instanceof Error
            ? error.message
            : 'Action failed. Please try again.',
      });
    } finally {
      submitting.current = false;
    }
  };

  const ConfirmDialog = () => {
    const props = dialog.kind === 'closed' ? null : dialog.props;
    const isSubmitting = dialog.kind === 'submitting';
    return (
      <Modal
        isOpen={dialog.kind !== 'closed'}
        onOpenChange={open => {
          if (!open) closeDialog();
        }}
        size='md'
      >
        <ModalContent>
          {() => (
            <>
              <ModalHeader className='flex flex-col gap-1'>
                {props?.title || 'Confirm Action'}
              </ModalHeader>
              <ModalBody>
                <p>{props?.message}</p>
                {dialog.kind === 'open' && dialog.error && (
                  <p role='alert' className='text-danger'>
                    {dialog.error}
                  </p>
                )}
              </ModalBody>
              <ModalFooter>
                <Button
                  variant='light'
                  onPress={closeDialog}
                  isDisabled={isSubmitting}
                >
                  {props?.cancelText || 'Cancel'}
                </Button>
                <Button
                  color={props?.confirmColor || 'danger'}
                  onPress={handleConfirm}
                  isLoading={isSubmitting}
                  isDisabled={isSubmitting}
                >
                  {isSubmitting
                    ? 'Processing...'
                    : props?.confirmText || 'Confirm'}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    );
  };

  return {
    showConfirm,
    ConfirmDialog,
    closeDialog,
  };
}
