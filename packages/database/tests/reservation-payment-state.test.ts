import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  reservationPaymentSummary,
  type ReservationReceipt,
} from '../src/reservation-payment-state';
import { ReservationRuleError } from '../src/reservation-capacity';

const payment = {
  id: 'payment',
  type: 'payment',
  amountCents: 100,
  method: 'cash',
  reference: '',
  actor: 'staff',
  recordedAt: new Date('2030-06-01'),
} satisfies ReservationReceipt;

test('reservation summaries preserve ordinary nearest-cent rounding of legacy totals', () => {
  for (const [totalPrice, totalCents] of [
    [0, 0],
    [0.29, 29],
    [1.005, 100],
    [0.005, 1],
  ]) {
    const summary = reservationPaymentSummary({
      totalPrice,
      isPaid: false,
      receipts: [],
    });
    assert.equal(summary.totalCents, totalCents);
    assert.equal(summary.balanceCents, totalCents);
  }
});

test('refunds reduce refundable receipts without reopening the gross paid balance', () => {
  assert.deepEqual(
    reservationPaymentSummary({
      totalPrice: 1,
      isPaid: true,
      receipts: [
        payment,
        { ...payment, id: 'refund', type: 'refund', amountCents: 100 },
      ],
    }),
    {
      totalCents: 100,
      paidCents: 100,
      refundedCents: 100,
      balanceCents: 0,
      refundableCents: 0,
      legacyPaid: false,
    }
  );
});

test('historical paid flags establish payment without inventing refundable receipts', () => {
  assert.deepEqual(
    reservationPaymentSummary({
      totalPrice: 1.005,
      isPaid: true,
      receipts: [],
    }),
    {
      totalCents: 100,
      paidCents: 100,
      refundedCents: 0,
      balanceCents: 0,
      refundableCents: 0,
      legacyPaid: true,
    }
  );
});

test('invalid totals and receipt cents fail with a reservation error instead of propagating unsafe arithmetic', () => {
  for (const totalPrice of [-1, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
    assert.throws(
      () =>
        reservationPaymentSummary({ totalPrice, isPaid: false, receipts: [] }),
      ReservationRuleError
    );
  }
  for (const amountCents of [
    0,
    -1,
    1.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    for (const type of ['payment', 'refund'] as const) {
      assert.throws(
        () =>
          reservationPaymentSummary({
            totalPrice: 1,
            isPaid: false,
            receipts: [{ ...payment, type, amountCents }],
          }),
        ReservationRuleError
      );
    }
  }
});

test('unsafe aggregate receipts and refunds fail before an imprecise balance can be returned', () => {
  for (const type of ['payment', 'refund'] as const) {
    assert.throws(
      () =>
        reservationPaymentSummary({
          totalPrice: 1,
          isPaid: false,
          receipts: [
            { ...payment, type, amountCents: Number.MAX_SAFE_INTEGER },
            { ...payment, id: 'overflow', type, amountCents: 1 },
          ],
        }),
      ReservationRuleError
    );
  }
});
