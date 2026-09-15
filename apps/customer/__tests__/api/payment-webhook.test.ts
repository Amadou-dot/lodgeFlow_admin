/** @jest-environment node */
jest.mock('@lodgeflow/database', () => ({
  connectDB: jest.fn(),
  Booking: { findOne: jest.fn(), updateOne: jest.fn() },
  ProcessedStripeEvent: { exists: jest.fn(), updateOne: jest.fn() },
  settleCheckoutPayment: jest.fn(),
  roundMoney: (amount: number) => Math.round(amount * 100) / 100,
}));
jest.mock('@/lib/stripe', () => ({ getStripe: jest.fn() }));
jest.mock('@/lib/email', () => ({ sendPaymentConfirmationEmail: jest.fn() }));
import Stripe from 'stripe';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/payments/webhook/route';
import {
  Booking,
  ProcessedStripeEvent,
  settleCheckoutPayment,
} from '@lodgeflow/database';
import { getStripe } from '@/lib/stripe';
const stripe = new Stripe('sk_test_webhook_unit_test');
const secret = 'whsec_unit_test';
const paidEvent = {
  id: 'evt_paid',
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_paid',
      payment_status: 'paid',
      amount_total: 15000,
      currency: 'usd',
      payment_intent: 'pi_paid',
      metadata: { bookingId: 'booking', quoteToken: 'quote' },
    },
  },
};
function signedRequest(event: unknown) {
  const payload = JSON.stringify(event);
  return new NextRequest('http://localhost/api/payments/webhook', {
    method: 'POST',
    body: payload,
    headers: {
      'stripe-signature': stripe.webhooks.generateTestHeaderString({
        payload,
        secret,
      }),
    },
  });
}
beforeEach(() => {
  jest.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = secret;
  (getStripe as jest.Mock).mockReturnValue(stripe);
  (ProcessedStripeEvent.exists as jest.Mock).mockResolvedValue(null);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());
it('rejects an invalid signature before touching payment records', async () => {
  const response = await POST(
    new NextRequest('http://localhost/api/payments/webhook', {
      method: 'POST',
      body: '{}',
      headers: { 'stripe-signature': 'invalid' },
    })
  );
  expect(response.status).toBe(400);
  expect(settleCheckoutPayment).not.toHaveBeenCalled();
});
it('does not mark a failed settlement processed, allowing a signed retry to succeed', async () => {
  (settleCheckoutPayment as jest.Mock)
    .mockRejectedValueOnce(new Error('Database unavailable'))
    .mockResolvedValueOnce({ booking: null, changed: false });
  expect((await POST(signedRequest(paidEvent))).status).toBe(500);
  expect(ProcessedStripeEvent.updateOne).not.toHaveBeenCalled();
  expect((await POST(signedRequest(paidEvent))).status).toBe(200);
  expect(settleCheckoutPayment).toHaveBeenLastCalledWith({
    bookingId: 'booking',
    sessionId: 'cs_paid',
    quoteToken: 'quote',
    amount: 150,
    currency: 'usd',
    paymentIntentId: 'pi_paid',
  });
  expect(ProcessedStripeEvent.updateOne).toHaveBeenCalledTimes(1);
});
it('does not settle an unpaid checkout event', async () => {
  const event = {
    ...paidEvent,
    data: { object: { ...paidEvent.data.object, payment_status: 'unpaid' } },
  };
  expect((await POST(signedRequest(event))).status).toBe(200);
  expect(settleCheckoutPayment).not.toHaveBeenCalled();
});
it('older refund events cannot reduce the amount already refunded', async () => {
  const booking = {
    payments: [
      { paymentIntentId: 'pi_paid', amount: 150, refundedAmount: 100 },
    ],
    amountPaid: 150,
    save: jest.fn().mockResolvedValue(undefined),
    refundAmount: 100,
  };
  (Booking.findOne as jest.Mock).mockResolvedValue(booking);
  expect(
    (
      await POST(
        signedRequest({
          id: 'evt_old_refund',
          type: 'charge.refunded',
          data: {
            object: { payment_intent: 'pi_paid', amount_refunded: 5000 },
          },
        })
      )
    ).status
  ).toBe(200);
  expect(booking.refundAmount).toBe(100);
  expect(booking.payments[0].refundedAmount).toBe(100);
});
