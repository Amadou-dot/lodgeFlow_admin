/** @jest-environment node */
jest.mock('@/lib/reservation-confirmation-email', () => ({
  sendReservationConfirmation: jest.fn(),
}));
jest.mock('@lodgeflow/database', () => ({
  connectDB: jest.fn(),
  Booking: { findOne: jest.fn(), updateOne: jest.fn() },
  ProcessedStripeEvent: { exists: jest.fn(), updateOne: jest.fn() },
  settleCheckoutPayment: jest.fn(),
  settleReservationCheckout: jest.fn(),
  expireReservationCheckout: jest.fn(),
  settleReservationRefund: jest.fn(),
  roundMoney: (amount: number) => Math.round(amount * 100) / 100,
}));
jest.mock('@/lib/stripe', () => ({ getStripe: jest.fn() }));
jest.mock('@/lib/email', () => ({ sendPaymentConfirmationEmail: jest.fn() }));
import Stripe from 'stripe';
import { sendReservationConfirmation } from '@/lib/reservation-confirmation-email';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/payments/webhook/route';
import {
  Booking,
  ProcessedStripeEvent,
  settleCheckoutPayment,
  settleReservationCheckout,
  expireReservationCheckout,
  settleReservationRefund,
} from '@lodgeflow/database';
import { getStripe } from '@/lib/stripe';
import { sendPaymentConfirmationEmail } from '@/lib/email';
import { Types } from 'mongoose';
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
  jest.resetAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = secret;
  (getStripe as jest.Mock).mockReturnValue(stripe);
  (ProcessedStripeEvent.exists as jest.Mock).mockResolvedValue(null);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

function settledBooking() {
  const booking = {
    _id: new Types.ObjectId('507f1f77bcf86cd7994390ab'),
    customer: 'customer',
    checkInDate: new Date('2030-06-03T15:00:00Z'),
    checkOutDate: new Date('2030-06-05T15:00:00Z'),
    totalPrice: 300,
    remainingAmount: 150,
    cabin: { name: 'Pine Cabin' },
  };
  return { ...booking, populate: jest.fn().mockResolvedValue(booking) };
}

it('acknowledges settlement with a missing cabin without sending or marking delivery', async () => {
  const booking = settledBooking();
  booking.populate.mockResolvedValue({ ...booking, cabin: null });
  (settleCheckoutPayment as jest.Mock).mockResolvedValue({
    changed: true,
    booking,
  });
  expect((await POST(signedRequest(paidEvent))).status).toBe(200);
  expect(sendPaymentConfirmationEmail).not.toHaveBeenCalled();
  expect(Booking.updateOne).not.toHaveBeenCalled();
  expect(ProcessedStripeEvent.updateOne).toHaveBeenCalledTimes(1);
});

it.each(['true', 'false'])(
  'sends a changed settlement with its signed amount and deposit flag %s',
  async isDeposit => {
    const booking = settledBooking();
    (settleCheckoutPayment as jest.Mock).mockResolvedValue({
      changed: true,
      booking,
    });
    (sendPaymentConfirmationEmail as jest.Mock).mockResolvedValue({
      success: true,
      messageId: 'message',
    });
    const event = {
      ...paidEvent,
      data: {
        object: {
          ...paidEvent.data.object,
          metadata: { ...paidEvent.data.object.metadata, isDeposit },
        },
      },
    };
    const response = await POST(signedRequest(event));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(sendPaymentConfirmationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        booking: {
          _id: booking._id.toHexString(),
          customer: 'customer',
          checkInDate: '2030-06-03T15:00:00.000Z',
          checkOutDate: '2030-06-05T15:00:00.000Z',
          totalPrice: 300,
          remainingAmount: 150,
        },
        amountPaid: 150,
        isDeposit: isDeposit === 'true',
        cabin: { name: 'Pine Cabin' },
      })
    );
    expect(Booking.updateOne).toHaveBeenCalledWith(
      { _id: booking._id },
      { $set: { paymentConfirmationSentAt: expect.any(Date) } }
    );
    expect(ProcessedStripeEvent.updateOne).toHaveBeenCalledTimes(1);
  }
);

it('does not repeat email delivery for processed events or unchanged receipts', async () => {
  (ProcessedStripeEvent.exists as jest.Mock).mockResolvedValueOnce({
    eventId: paidEvent.id,
  });
  expect((await POST(signedRequest(paidEvent))).status).toBe(200);
  expect(settleCheckoutPayment).not.toHaveBeenCalled();
  const booking = settledBooking();
  (settleCheckoutPayment as jest.Mock).mockResolvedValue({
    changed: false,
    booking,
  });
  expect(
    (await POST(signedRequest({ ...paidEvent, id: 'evt_same_receipt' }))).status
  ).toBe(200);
  expect(booking.populate).not.toHaveBeenCalled();
  expect(sendPaymentConfirmationEmail).not.toHaveBeenCalled();
  expect(Booking.updateOne).not.toHaveBeenCalled();
});

it.each(['rejected', 'thrown'])(
  'acknowledges durable settlement when email fails: %s',
  async failure => {
    (settleCheckoutPayment as jest.Mock).mockResolvedValue({
      changed: true,
      booking: settledBooking(),
    });
    if (failure === 'thrown')
      (sendPaymentConfirmationEmail as jest.Mock).mockRejectedValue(
        new Error('Email unavailable')
      );
    else
      (sendPaymentConfirmationEmail as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Email unavailable',
      });
    const response = await POST(signedRequest(paidEvent));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(Booking.updateOne).not.toHaveBeenCalled();
    expect(ProcessedStripeEvent.updateOne).toHaveBeenCalledTimes(1);
  }
);
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

for (const kind of ['dining', 'experience']) {
  it(`routes signed ${kind} payments and expirations to reservation accounting`, async () => {
    const object = {
      ...paidEvent.data.object,
      metadata: {
        reservationKind: kind,
        reservationId: 'reservation',
        quoteToken: 'quote',
      },
    };
    expect(
      (await POST(signedRequest({ ...paidEvent, data: { object } }))).status
    ).toBe(200);
    expect(settleReservationCheckout).toHaveBeenCalledWith({
      kind,
      id: 'reservation',
      token: 'quote',
      sessionId: 'cs_paid',
      amountCents: 15000,
      currency: 'usd',
      paymentIntentId: 'pi_paid',
    });
    expect(settleCheckoutPayment).not.toHaveBeenCalled();
    expect(
      (
        await POST(
          signedRequest({
            ...paidEvent,
            type: 'checkout.session.expired',
            data: { object },
          })
        )
      ).status
    ).toBe(200);
    expect(expireReservationCheckout).toHaveBeenCalledWith({
      kind,
      id: 'reservation',
      token: 'quote',
    });
  });
}
it('routes refund status changes and preserves retries after database failure', async () => {
  const event = {
    id: 'evt_refund',
    type: 'refund.updated',
    data: {
      object: {
        id: 're_test',
        status: 'succeeded',
        metadata: {
          reservationKind: 'dining',
          reservationId: 'reservation',
          refundToken: 'refund',
        },
      },
    },
  };
  (settleReservationRefund as jest.Mock)
    .mockRejectedValueOnce(new Error('Database unavailable'))
    .mockResolvedValueOnce(undefined);
  expect((await POST(signedRequest(event))).status).toBe(500);
  expect(ProcessedStripeEvent.updateOne).not.toHaveBeenCalled();
  expect((await POST(signedRequest(event))).status).toBe(200);
  expect(settleReservationRefund).toHaveBeenCalledWith({
    kind: 'dining',
    id: 'reservation',
    token: 'refund',
    refundId: 're_test',
    status: 'succeeded',
  });
});

it('retries confirmation delivery after settlement without treating an unpaid event as confirmed', async () => {
  const event = {
    ...paidEvent,
    data: {
      object: {
        ...paidEvent.data.object,
        metadata: {
          reservationKind: 'dining',
          reservationId: 'reservation',
          quoteToken: 'quote',
        },
      },
    },
  };
  (sendReservationConfirmation as jest.Mock)
    .mockRejectedValueOnce(new Error('Email unavailable'))
    .mockResolvedValueOnce(undefined);
  expect((await POST(signedRequest(event))).status).toBe(500);
  expect(ProcessedStripeEvent.updateOne).not.toHaveBeenCalled();
  expect((await POST(signedRequest(event))).status).toBe(200);
  expect(sendReservationConfirmation).toHaveBeenCalledTimes(2);
  jest.clearAllMocks();
  expect(
    (
      await POST(
        signedRequest({
          ...event,
          data: { object: { ...event.data.object, payment_status: 'unpaid' } },
        })
      )
    ).status
  ).toBe(200);
  expect(sendReservationConfirmation).not.toHaveBeenCalled();
});
