import Stripe from 'stripe';
import { logger } from '@lodgeflow/database/logger';
import {
  cents,
  centsToMajor,
  majorAmount,
  majorToCents,
  type MajorCurrencyAmount,
} from '@lodgeflow/database/money';

// Singleton Stripe instance
let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set');
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeInstance;
}

export interface CreateCheckoutSessionParams {
  bookingId: string;
  amount: number;
  isDeposit: boolean;
  customerEmail: string;
  cabinName: string;
  checkInDate: string;
  checkOutDate: string;
  successUrl: string;
  cancelUrl: string;
}

export async function createCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<Stripe.Checkout.Session> {
  const amount = majorToCents({
    amount: majorAmount(params.amount, {
      precision: 'preserve',
      sign: 'positive',
    }),
    rounding: 'nearest',
  });
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    customer_email: params.customerEmail,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${params.cabinName} - ${params.isDeposit ? 'Deposit' : 'Full Payment'}`,
            description: `Stay from ${params.checkInDate} to ${params.checkOutDate}`,
          },
          unit_amount: amount,
        },
        quantity: 1,
      },
    ],
    metadata: {
      bookingId: params.bookingId,
      isDeposit: params.isDeposit.toString(),
    },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });

  return session;
}

export type RefundResult =
  | { success: true; refundId: string; amount: MajorCurrencyAmount }
  | { success: false; error: string };

export async function createRefund({
  paymentIntentId,
  amount,
  idempotencyKey,
}: {
  paymentIntentId: string;
  amount?: number;
  idempotencyKey?: string;
}): Promise<RefundResult> {
  const stripe = getStripe();

  try {
    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: paymentIntentId,
    };

    if (amount !== undefined) {
      refundParams.amount = majorToCents({
        amount: majorAmount(amount, { precision: 'exact', sign: 'positive' }),
        rounding: 'exact',
      });
    }

    const refund = await stripe.refunds.create(
      refundParams,
      idempotencyKey ? { idempotencyKey } : undefined
    );

    return {
      success: true,
      refundId: refund.id,
      amount: centsToMajor(cents(refund.amount)),
    };
  } catch (error) {
    logger.error('Stripe refund error', error);
    return {
      success: false,
      error: 'Failed to create refund',
    };
  }
}

export async function getPaymentIntent(
  paymentIntentId: string
): Promise<Stripe.PaymentIntent | null> {
  const stripe = getStripe();

  try {
    return await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch (error) {
    logger.error('Error retrieving payment intent', error);
    return null;
  }
}
