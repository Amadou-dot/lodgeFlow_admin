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
import {
  cents,
  centsToMajor,
  majorAmount,
  majorToCents,
  majorToFixed,
  MoneyError,
  type Cents,
  type MajorCurrencyAmount,
} from '@lodgeflow/database/money';

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

function parsePaymentAmount({
  value,
  remainingAmount,
}: {
  value: string;
  remainingAmount: MajorCurrencyAmount;
}): MajorCurrencyAmount | undefined {
  try {
    const amount = majorAmount(Number(value), {
      precision: 'exact',
      sign: 'positive',
    });
    return amount <= remainingAmount ? amount : undefined;
  } catch (error) {
    if (error instanceof MoneyError) return undefined;
    throw error;
  }
}

function halfPaymentAmount(
  remaining: MajorCurrencyAmount
): MajorCurrencyAmount {
  let remainingCents: Cents;
  try {
    remainingCents = majorToCents({ amount: remaining, rounding: 'exact' });
  } catch (error) {
    if (!(error instanceof MoneyError)) throw error;
    // Preserve display precision for historical balances, but choose a
    // cent amount for the preset using ordinary nearest-cent rounding.
    remainingCents = majorToCents({ amount: remaining, rounding: 'nearest' });
  }
  // Split cents and round a half cent up once for the label and submission.
  // Major-unit division can otherwise turn half of 0.29 into 0.14.
  return centsToMajor(cents(Math.round(remainingCents / 2)));
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
  const total = majorAmount(totalAmount, { precision: 'preserve' });
  const remaining = majorAmount(remainingAmount, { precision: 'preserve' });
  const half = halfPaymentAmount(remaining);
  const parsedAmount = parsePaymentAmount({
    value: amountPaid,
    remainingAmount: remaining,
  });

  const paymentMethods = [
    { key: 'cash', label: 'Cash' },
    { key: 'card', label: 'Credit/Debit Card' },
    { key: 'bank-transfer', label: 'Bank Transfer' },
    { key: 'online', label: 'Online Payment' },
  ];

  const handleSubmit = async () => {
    if (!paymentMethod || parsedAmount === undefined) return;

    setIsLoading(true);
    try {
      await onRecordPayment({
        paymentMethod: paymentMethod as PaymentData['paymentMethod'],
        amountPaid: parsedAmount,
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

  const handleAmountPreset = (amount: MajorCurrencyAmount) => {
    setAmountPaid(majorToFixed({ amount }));
  };

  const isValid = paymentMethod && parsedAmount !== undefined;

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
                <span className='font-semibold'>
                  ${majorToFixed({ amount: total })}
                </span>
              </div>
              <div className='flex justify-between items-center'>
                <span className='text-sm text-default-600'>Remaining:</span>
                <span className='font-semibold text-warning'>
                  ${majorToFixed({ amount: remaining })}
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
                  onPress={() => handleAmountPreset(remaining)}
                >
                  Full Amount (${majorToFixed({ amount: remaining })})
                </Button>
                <Button
                  variant='bordered'
                  size='sm'
                  onPress={() => handleAmountPreset(half)}
                >
                  Half (${majorToFixed({ amount: half })})
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
