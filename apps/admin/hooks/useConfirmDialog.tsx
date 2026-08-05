import { useState } from 'react';
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
    | 'default'
    | 'primary'
    | 'secondary'
    | 'success'
    | 'warning'
    | 'danger';
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
}

export function useConfirmDialog() {
  const [dialogProps, setDialogProps] = useState<ConfirmDialogProps | null>(
    null
  );
  const [isOpen, setIsOpen] = useState(false);

  const showConfirm = (props: ConfirmDialogProps) => {
    setDialogProps(props);
    setIsOpen(true);
  };

  const closeDialog = () => {
    setIsOpen(false);
    setDialogProps(null);
  };

  const handleConfirm = async () => {
    if (dialogProps?.onConfirm) {
      await dialogProps.onConfirm();
    }
    closeDialog();
  };

  const ConfirmDialog = () => (
    <Modal isOpen={isOpen} onOpenChange={setIsOpen} size='md'>
      <ModalContent>
        {onClose => (
          <>
            <ModalHeader className='flex flex-col gap-1'>
              {dialogProps?.title || 'Confirm Action'}
            </ModalHeader>
            <ModalBody>
              <p>{dialogProps?.message}</p>
            </ModalBody>
            <ModalFooter>
              <Button variant='light' onPress={onClose}>
                {dialogProps?.cancelText || 'Cancel'}
              </Button>
              <Button
                color={dialogProps?.confirmColor || 'danger'}
                onPress={handleConfirm}
                isLoading={dialogProps?.isLoading}
              >
                {dialogProps?.isLoading
                  ? 'Processing...'
                  : dialogProps?.confirmText || 'Confirm'}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );

  return {
    showConfirm,
    ConfirmDialog,
    closeDialog,
  };
}
