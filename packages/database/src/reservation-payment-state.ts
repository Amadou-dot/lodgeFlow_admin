import { Schema } from 'mongoose';
import { cents, majorAmount, majorToCents, type Cents } from './money';
import { reservationMoney } from './reservation-errors';

export interface ReservationReceipt {
  id: string;
  type: 'payment' | 'refund';
  amountCents: number;
  method: 'cash' | 'bank_transfer' | 'card' | 'stripe';
  reference: string;
  actor: string;
  recordedAt: Date;
}
export interface ReservationPaymentState {
  receipts: ReservationReceipt[];
  paymentConfirmationSentAt?: Date;
  checkout?: {
    token: string;
    amountCents: number;
    currency: string;
    createdAt: Date;
    sessionId?: string;
    pending: boolean;
  };
  stripeRefund?: {
    token: string;
    amountCents: number;
    createdAt: Date;
    refundId?: string;
    status: 'pending' | 'succeeded' | 'failed';
    actor: string;
    reference: string;
  };
}
export const reservationPaymentFields = {
  paymentConfirmationSentAt: { type: Date },
  checkout: {
    type: new Schema(
      {
        token: String,
        amountCents: Number,
        currency: String,
        createdAt: Date,
        sessionId: String,
        pending: Boolean,
      },
      { _id: false }
    ),
  },
  stripeRefund: {
    type: new Schema(
      {
        token: String,
        amountCents: Number,
        createdAt: Date,
        refundId: String,
        status: { type: String, enum: ['pending', 'succeeded', 'failed'] },
        actor: String,
        reference: String,
      },
      { _id: false }
    ),
  },
  receipts: {
    type: [
      new Schema(
        {
          id: { type: String, required: true },
          type: { type: String, enum: ['payment', 'refund'], required: true },
          amountCents: { type: Number, required: true, min: 1 },
          method: {
            type: String,
            enum: ['cash', 'bank_transfer', 'card', 'stripe'],
            required: true,
          },
          reference: { type: String, default: '' },
          actor: { type: String, required: true },
          recordedAt: { type: Date, required: true },
        },
        { _id: false }
      ),
    ],
    default: [],
  },
};

export function reservationPaymentSummary(
  reservation: ReservationPaymentState & {
    totalPrice: number;
    isPaid: boolean;
  }
): {
  totalCents: Cents;
  paidCents: Cents;
  refundedCents: Cents;
  balanceCents: Cents;
  refundableCents: Cents;
  legacyPaid: boolean;
} {
  return reservationMoney(() => {
    const totalCents = majorToCents({
      amount: majorAmount(reservation.totalPrice, { precision: 'preserve' }),
      rounding: 'nearest',
    });
    if (reservation.checkout)
      cents(reservation.checkout.amountCents, { sign: 'positive' });
    if (reservation.stripeRefund)
      cents(reservation.stripeRefund.amountCents, { sign: 'positive' });
    const receipts = reservation.receipts ?? [];
    // Existing paid flags remain historical evidence; never invent refundable receipts.
    const legacyPaid =
      reservation.isPaid && !receipts.some(row => row.type === 'payment');
    let paidCents = cents(0);
    let refundedCents = cents(0);
    for (const row of receipts) {
      const amount = cents(row.amountCents, { sign: 'positive' });
      if (row.type === 'payment') paidCents = cents(paidCents + amount);
      else refundedCents = cents(refundedCents + amount);
    }
    if (legacyPaid) paidCents = totalCents;
    return {
      totalCents,
      paidCents,
      refundedCents,
      balanceCents: cents(Math.max(0, totalCents - paidCents)),
      refundableCents: cents(legacyPaid ? 0 : paidCents - refundedCents),
      legacyPaid,
    };
  });
}

export function reservationTenderBalance({
  receipts,
  method,
}: {
  receipts: readonly ReservationReceipt[];
  method: ReservationReceipt['method'];
}): Cents {
  return reservationMoney(() => {
    let paid = cents(0);
    let refunded = cents(0);
    for (const receipt of receipts) {
      if (receipt.method !== method) continue;
      const amount = cents(receipt.amountCents, { sign: 'positive' });
      if (receipt.type === 'payment') paid = cents(paid + amount);
      else refunded = cents(refunded + amount);
    }
    return cents(paid - refunded);
  });
}
