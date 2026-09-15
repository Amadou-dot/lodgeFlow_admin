'use client';

import { Button } from '@heroui/button';
import { Input, Textarea } from '@heroui/input';
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/modal';
import { Select, SelectItem } from '@heroui/select';
import { useState } from 'react';

export interface PaymentData {
  paymentMethod: 'cash' | 'card' | 'bank-transfer' | 'online';
  amountPaid: number;
  notes?: string;
}

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecordPayment: (paymentData: PaymentData) => Promise<void>;
  totalAmount: number;
  remainingAmount: number;
  bookingId: string;
  guestName: string;
}

export default function RecordPaymentModal({
  isOpen,
  onClose,
  onRecordPayment,
  totalAmount,
  remainingAmount,
  bookingId,
  guestName,
}: RecordPaymentModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const paymentMethods = [
    { key: 'cash', label: 'Cash' },
    { key: 'card', label: 'Credit/Debit Card' },
    { key: 'bank-transfer', label: 'Bank Transfer' },
    { key: 'online', label: 'Online Payment' },
  ];

  const handleSubmit = async () => {
    if (!paymentMethod || !amountPaid) return;

    const amount = parseFloat(amountPaid);
    if (isNaN(amount) || amount <= 0) return;

    setIsLoading(true);
    try {
      await onRecordPayment({
        paymentMethod: paymentMethod as PaymentData['paymentMethod'],
        amountPaid: amount,
        notes: notes.trim() || undefined,
      });
      handleClose();
    } catch (error) {
      // Error handling is done in the parent component
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setPaymentMethod('');
    setAmountPaid('');
    setNotes('');
    onClose();
  };

  const handleAmountPreset = (amount: number) => {
    setAmountPaid(amount.toString());
  };

  const isValid = paymentMethod && amountPaid && parseFloat(amountPaid) > 0;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size='md'>
      <ModalContent>
        <ModalHeader className='flex flex-col gap-1'>
          <h2 className='text-xl font-semibold'>Record Payment</h2>
          <p className='text-sm text-default-600'>
            Booking ID: {bookingId.slice(-8)} • Guest: {guestName}
          </p>
        </ModalHeader>
        <ModalBody>
          <div className='space-y-4'>
            {/* Payment Summary */}
            <div className='bg-default-50 p-4 rounded-lg'>
              <div className='flex justify-between items-center mb-2'>
                <span className='text-sm text-default-600'>Total Amount:</span>
                <span className='font-semibold'>${totalAmount.toFixed(2)}</span>
              </div>
              <div className='flex justify-between items-center'>
                <span className='text-sm text-default-600'>Remaining:</span>
                <span className='font-semibold text-warning'>
                  ${remainingAmount.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Quick Amount Buttons */}
            <div className='space-y-2'>
              <label className='text-sm font-medium'>Quick Select Amount</label>
              <div className='grid grid-cols-2 gap-2'>
                <Button
                  variant='bordered'
                  size='sm'
                  onPress={() => handleAmountPreset(remainingAmount)}
                >
                  Full Amount (${remainingAmount.toFixed(2)})
                </Button>
                <Button
                  variant='bordered'
                  size='sm'
                  onPress={() => handleAmountPreset(remainingAmount / 2)}
                >
                  Half (${(remainingAmount / 2).toFixed(2)})
                </Button>
              </div>
            </div>

            {/* Amount Input */}
            <Input
              label='Amount Paid'
              placeholder='0.00'
              value={amountPaid}
              onValueChange={setAmountPaid}
              startContent={
                <div className='pointer-events-none flex items-center'>
                  <span className='text-default-400 text-small'>$</span>
                </div>
              }
              type='number'
              step='0.01'
              min='0'
              max={remainingAmount}
              isRequired
            />

            {/* Payment Method */}
            <Select
              label='Payment Method'
              placeholder='Select payment method'
              selectedKeys={paymentMethod ? [paymentMethod] : []}
              onSelectionChange={keys => {
                const selected = Array.from(keys)[0] as string;
                setPaymentMethod(selected || '');
              }}
              isRequired
            >
              {paymentMethods.map(method => (
                <SelectItem key={method.key}>{method.label}</SelectItem>
              ))}
            </Select>

            {/* Notes */}
            <Textarea
              label='Payment Notes (Optional)'
              placeholder='Add any additional notes about this payment...'
              value={notes}
              onValueChange={setNotes}
              maxRows={3}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant='light' onPress={handleClose} isDisabled={isLoading}>
            Cancel
          </Button>
          <Button
            color='primary'
            onPress={handleSubmit}
            isLoading={isLoading}
            isDisabled={!isValid}
          >
            Record Payment
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
