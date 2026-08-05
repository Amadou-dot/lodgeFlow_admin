import { Button } from '@heroui/button';
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure,
} from '@heroui/modal';
import { addToast } from '@heroui/toast';
import { UseMutationResult } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { TrashIcon } from './icons';

interface ModalProps {
  resourceId: string;
  resourceName: string;
  note?: string;
  onDelete:
    | UseMutationResult<unknown, Error, string, unknown>
    | (() => Promise<void>);
  onResourceDeleted?: () => void;
  itemName?: string;
  children?: ReactNode; // Custom trigger button
  isOpen?: boolean; // For external control
  onOpenChange?: (open: boolean) => void; // For external control
  buttonProps?: {
    className?: string;
    color?:
      | 'default'
      | 'primary'
      | 'secondary'
      | 'success'
      | 'warning'
      | 'danger';
    variant?:
      | 'solid'
      | 'bordered'
      | 'light'
      | 'flat'
      | 'faded'
      | 'shadow'
      | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    startContent?: ReactNode;
    disabled?: boolean;
  };
}

export default function DeletionModal({
  resourceId,
  resourceName,
  note,
  onDelete,
  onResourceDeleted,
  itemName,
  children,
  isOpen: externalIsOpen,
  onOpenChange: externalOnOpenChange,
  buttonProps = {},
}: ModalProps) {
  const internalDisclosure = useDisclosure();

  // Use external control if provided, otherwise use internal
  const isOpen =
    externalIsOpen !== undefined ? externalIsOpen : internalDisclosure.isOpen;
  const onOpenChange = externalOnOpenChange || internalDisclosure.onOpenChange;
  const onOpen = internalDisclosure.onOpen;

  const handleDelete = async () => {
    if (!resourceId) {
      addToast({
        title: 'Error',
        description: 'Resource ID is missing',
        color: 'danger',
      });
      return;
    }

    try {
      if (typeof onDelete === 'function') {
        // Handle simple async function
        await onDelete();
      } else {
        // Handle React Query mutation
        await onDelete.mutateAsync(resourceId);
      }

      onOpenChange(false); // Close modal
      onResourceDeleted?.(); // Refresh resource list
      addToast({
        title: `${resourceName} Deleted`,
        description: `The ${resourceName.toLowerCase()} has been successfully deleted.`,
        color: 'success',
      });
    } catch (error: unknown) {
      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      addToast({
        title: `Error deleting ${resourceName.toLowerCase()}`,
        description: errorMessage,
        color: 'danger',
      });
    }
  };

  const defaultButtonProps = {
    className: 'w-full sm:w-auto',
    color: 'danger' as const,
    startContent: <TrashIcon />,
    variant: 'flat' as const,
    ...buttonProps,
  };

  const isDeleting = typeof onDelete !== 'function' && onDelete.isPending;

  return (
    <>
      {/* Render custom trigger or default button */}
      {children ? (
        <div onClick={onOpen} className='cursor-pointer'>
          {children}
        </div>
      ) : (
        <Button {...defaultButtonProps} onPress={onOpen}>
          Delete
        </Button>
      )}

      <Modal isOpen={isOpen} onOpenChange={onOpenChange} size='md'>
        <ModalContent>
          {onClose => (
            <>
              <ModalHeader className='flex flex-col gap-1'>
                Delete {resourceName}
              </ModalHeader>
              <ModalBody>
                <p>
                  Are you sure you want to delete {resourceName.toLowerCase()}
                  {itemName && (
                    <>
                      : <strong>{itemName}</strong>
                    </>
                  )}
                  ?
                </p>
                <p className='text-danger text-sm'>
                  This action cannot be undone.
                </p>
                {note && (
                  <p className='text-warning text-sm mt-2'>Note: {note}</p>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant='light' onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  color='danger'
                  onPress={handleDelete}
                  isLoading={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
