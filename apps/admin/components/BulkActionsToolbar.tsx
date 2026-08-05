'use client';

import { Button } from '@heroui/button';
import { Input } from '@heroui/input';
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/modal';
import { UseMutationResult } from '@tanstack/react-query';
import { Percent, Trash2, X } from 'lucide-react';
import { useState } from 'react';

interface BulkActionsToolbarProps {
  selectedCount: number;
  selectedNames: string[];
  selectedIds: string[];
  onClearSelection: () => void;
  bulkDelete: UseMutationResult<
    { deletedCount: number },
    Error,
    string[],
    unknown
  >;
  bulkUpdateDiscount: UseMutationResult<
    { modifiedCount: number },
    Error,
    { ids: string[]; discount: number },
    unknown
  >;
}

export default function BulkActionsToolbar({
  selectedCount,
  selectedNames,
  selectedIds,
  onClearSelection,
  bulkDelete,
  bulkUpdateDiscount,
}: BulkActionsToolbarProps) {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [discountAmount, setDiscountAmount] = useState('');

  const handleBulkDelete = async () => {
    try {
      await bulkDelete.mutateAsync(selectedIds);
      setIsDeleteModalOpen(false);
      onClearSelection();
    } catch {
      // Error is handled by the mutation's onError/toast
    }
  };

  const handleBulkDiscount = async () => {
    const discount = parseFloat(discountAmount);
    if (isNaN(discount) || discount < 0) return;

    try {
      await bulkUpdateDiscount.mutateAsync({ ids: selectedIds, discount });
      setIsDiscountModalOpen(false);
      setDiscountAmount('');
      onClearSelection();
    } catch {
      // Error is handled by the mutation's onError/toast
    }
  };

  return (
    <>
      <div className='flex items-center gap-3 bg-primary-50 dark:bg-primary-950/30 border border-primary-200 dark:border-primary-800 rounded-lg p-3'>
        <span className='text-sm font-medium text-primary-700 dark:text-primary-300'>
          {selectedCount} cabin{selectedCount === 1 ? '' : 's'} selected
        </span>

        <div className='flex items-center gap-2 ml-auto'>
          <Button
            size='sm'
            variant='flat'
            color='primary'
            startContent={<Percent className='w-3.5 h-3.5' />}
            onPress={() => setIsDiscountModalOpen(true)}
          >
            Set Discount
          </Button>
          <Button
            size='sm'
            variant='flat'
            color='danger'
            startContent={<Trash2 className='w-3.5 h-3.5' />}
            onPress={() => setIsDeleteModalOpen(true)}
          >
            Delete Selected
          </Button>
          <Button
            isIconOnly
            size='sm'
            variant='light'
            onPress={onClearSelection}
            aria-label='Clear selection'
          >
            <X className='w-4 h-4' />
          </Button>
        </div>
      </div>

      {/* Bulk Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        size='md'
      >
        <ModalContent>
          {onClose => (
            <>
              <ModalHeader>Delete {selectedCount} Cabins</ModalHeader>
              <ModalBody>
                <p>
                  Are you sure you want to delete the following cabin
                  {selectedCount === 1 ? '' : 's'}?
                </p>
                <ul className='list-disc list-inside text-sm text-default-600 mt-2 space-y-1'>
                  {selectedNames.map(name => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
                <p className='text-danger text-sm mt-3'>
                  This action cannot be undone.
                </p>
                <p className='text-warning text-sm'>
                  Note: Cabins with active bookings cannot be deleted.
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant='light' onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  color='danger'
                  onPress={handleBulkDelete}
                  isLoading={bulkDelete.isPending}
                >
                  {bulkDelete.isPending ? 'Deleting...' : 'Delete All'}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Bulk Discount Modal */}
      <Modal
        isOpen={isDiscountModalOpen}
        onOpenChange={open => {
          setIsDiscountModalOpen(open);
          if (!open) setDiscountAmount('');
        }}
        size='md'
      >
        <ModalContent>
          {onClose => (
            <>
              <ModalHeader>
                Set Discount for {selectedCount} Cabin
                {selectedCount === 1 ? '' : 's'}
              </ModalHeader>
              <ModalBody>
                <p className='text-sm text-default-600'>
                  This will set the same discount amount for all selected
                  cabins:
                </p>
                <ul className='list-disc list-inside text-sm text-default-500 mt-1 mb-3 space-y-1'>
                  {selectedNames.map(name => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
                <Input
                  type='number'
                  label='Discount Amount ($)'
                  placeholder='0'
                  min={0}
                  value={discountAmount}
                  onValueChange={setDiscountAmount}
                  startContent={
                    <span className='text-default-400 text-sm'>$</span>
                  }
                />
                <p className='text-warning text-xs mt-1'>
                  Discount cannot exceed the price of any selected cabin.
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant='light' onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  color='primary'
                  onPress={handleBulkDiscount}
                  isLoading={bulkUpdateDiscount.isPending}
                  isDisabled={!discountAmount || parseFloat(discountAmount) < 0}
                >
                  {bulkUpdateDiscount.isPending
                    ? 'Updating...'
                    : 'Apply Discount'}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
