import assert from 'node:assert/strict';
import { test } from 'node:test';
import { paymentSummary, type BookingPayment } from '../src/booking-payments';

function receipt(amount: number): BookingPayment {
  return {
    id: `receipt-${amount}`,
    amount,
    method: 'cash',
    receivedAt: new Date('2030-06-03T15:00:00Z'),
  };
}

for (const entry of [
  {
    name: 'deposit obligation without receipts never counts as money received',
    totalPrice: 300,
    depositAmount: 75,
    payments: [],
    expected: {
      amountPaid: 0,
      remainingAmount: 300,
      isPaid: false,
      depositPaid: false,
    },
  },
  {
    name: 'partial receipt below the deposit obligation',
    totalPrice: 300,
    depositAmount: 75,
    payments: [receipt(50)],
    expected: {
      amountPaid: 50,
      remainingAmount: 250,
      isPaid: false,
      depositPaid: false,
    },
  },
  {
    name: 'meeting the deposit obligation leaves the stay balance due',
    totalPrice: 300,
    depositAmount: 75,
    payments: [receipt(75)],
    expected: {
      amountPaid: 75,
      remainingAmount: 225,
      isPaid: false,
      depositPaid: true,
    },
  },
  {
    name: 'multiple receipts settle the full stay',
    totalPrice: 300,
    depositAmount: 75,
    payments: [receipt(75), receipt(225)],
    expected: {
      amountPaid: 300,
      remainingAmount: 0,
      isPaid: true,
      depositPaid: true,
    },
  },
  {
    name: 'decimal receipt sums and remaining money retain cent rounding',
    totalPrice: 1,
    depositAmount: 0.3,
    payments: [receipt(0.1), receipt(0.2)],
    expected: {
      amountPaid: 0.3,
      remainingAmount: 0.7,
      isPaid: false,
      depositPaid: true,
    },
  },
  {
    name: 'zero price has no balance but no deposit receipt',
    totalPrice: 0,
    depositAmount: 0,
    payments: [],
    expected: {
      amountPaid: 0,
      remainingAmount: 0,
      isPaid: true,
      depositPaid: false,
    },
  },
  {
    name: 'zero deposit is paid only after a positive receipt',
    totalPrice: 100,
    depositAmount: 0,
    payments: [receipt(1)],
    expected: {
      amountPaid: 1,
      remainingAmount: 99,
      isPaid: false,
      depositPaid: true,
    },
  },
]) {
  test(entry.name, () => {
    assert.deepEqual(
      paymentSummary({
        totalPrice: entry.totalPrice,
        depositAmount: entry.depositAmount,
        payments: entry.payments,
      }),
      entry.expected
    );
  });
}

test('summary reads gross receipts without mutating receipt or refund history', () => {
  const payments = [Object.freeze({ ...receipt(75), refundedAmount: 25 })];
  Object.freeze(payments);
  const before = structuredClone(payments);
  assert.deepEqual(
    paymentSummary({ totalPrice: 300, depositAmount: 75, payments }),
    {
      amountPaid: 75,
      remainingAmount: 225,
      isPaid: false,
      depositPaid: true,
    }
  );
  assert.deepEqual(payments, before);
});
