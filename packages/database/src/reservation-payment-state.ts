import { Schema } from 'mongoose';

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
) {
  const totalCents = Math.round(reservation.totalPrice * 100);
  const receipts = reservation.receipts ?? [];
  // Existing paid flags remain historical evidence; never invent refundable receipts.
  const legacyPaid =
    reservation.isPaid && !receipts.some(row => row.type === 'payment');
  const paidCents = legacyPaid
    ? totalCents
    : receipts.reduce(
        (sum, row) => sum + (row.type === 'payment' ? row.amountCents : 0),
        0
      );
  const refundedCents = receipts.reduce(
    (sum, row) => sum + (row.type === 'refund' ? row.amountCents : 0),
    0
  );
  return {
    totalCents,
    paidCents,
    refundedCents,
    balanceCents: Math.max(0, totalCents - paidCents),
    refundableCents: legacyPaid ? 0 : paidCents - refundedCents,
    legacyPaid,
  };
}
