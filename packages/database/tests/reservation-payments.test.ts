import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  DiningReservation,
  createReservationCheckout,
  ExperienceBooking,
  recordReservationReceipt,
  reservationPaymentSummary,
  settleReservationCheckout,
  refundReservationStripe,
  type ReservationStripeGateway,
  type ReservationReceipt,
} from '../src';
let server: MongoMemoryServer;
before(async () => {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri());
});
after(async () => {
  await mongoose.disconnect();
  await server?.stop();
});
beforeEach(async () => {
  await Promise.all([
    DiningReservation.deleteMany({}),
    ExperienceBooking.deleteMany({}),
  ]);
});
const payment = {
  id: 'receipt-1',
  type: 'payment' as const,
  method: 'cash' as const,
  amountCents: 2500,
  reference: '',
  actor: 'staff',
};
async function fixture(kind: 'dining' | 'experience') {
  const common = {
    customer: 'guest',
    date: new Date('2030-06-01'),
    totalPrice: 50,
    status: 'confirmed',
  };
  return kind === 'dining'
    ? DiningReservation.create({
        ...common,
        dining: new mongoose.Types.ObjectId(),
        time: '19:00',
        numGuests: 2,
      })
    : ExperienceBooking.create({
        ...common,
        experience: new mongoose.Types.ObjectId(),
        numParticipants: 2,
      });
}
for (const kind of ['dining', 'experience'] as const) {
  test(`${kind}: partial payments, retries, tender limits, and full refunds`, async () => {
    const row = await fixture(kind);
    const record = (receipt: Omit<ReservationReceipt, 'recordedAt'>) =>
      recordReservationReceipt({ kind, id: row.id, receipt });
    let result = await record(payment);
    assert.equal(result.reservation.isPaid, false);
    assert.equal(
      reservationPaymentSummary(result.reservation).balanceCents,
      2500
    );
    assert.equal((await record(payment)).changed, false);
    await assert.rejects(
      record({ ...payment, amountCents: 2600 }),
      /already used/
    );
    await assert.rejects(
      record({ ...payment, id: 'over', amountCents: 2600 }),
      /exceeds/
    );
    await assert.rejects(
      record({ ...payment, id: 'fraction', amountCents: 1.5 }),
      /whole number/
    );
    result = await record({ ...payment, id: 'receipt-2' });
    assert.equal(result.reservation.isPaid, true);
    await assert.rejects(
      record({ ...payment, id: 'refund-bad', type: 'refund', method: 'card' }),
      /exceeds/
    );
    result = await record({
      ...payment,
      id: 'refund',
      type: 'refund',
      amountCents: 5000,
    });
    assert.equal(
      reservationPaymentSummary(result.reservation).refundableCents,
      0
    );
    assert.equal(
      reservationPaymentSummary(result.reservation).refundedCents,
      5000
    );
    assert.equal(reservationPaymentSummary(result.reservation).balanceCents, 0);
  });
  test(`${kind}: concurrent payments cannot overcollect`, async () => {
    const row = await fixture(kind);
    const results = await Promise.allSettled(
      ['a', 'b'].map(id =>
        recordReservationReceipt({
          kind,
          id: row.id,
          receipt: { ...payment, id, amountCents: 5000 },
        })
      )
    );
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  });
  test(`${kind}: legacy paid records and pending checkout cannot accept manual payments`, async () => {
    const row = await fixture(kind);
    row.isPaid = true;
    await row.save();
    await assert.rejects(
      recordReservationReceipt({ kind, id: row.id, receipt: payment }),
      /reconciliation/
    );
    row.isPaid = false;
    row.checkout = {
      token: 'quote',
      pending: true,
      amountCents: 5000,
      currency: 'usd',
      createdAt: new Date(),
    };
    await row.save();
    await assert.rejects(
      recordReservationReceipt({ kind, id: row.id, receipt: payment }),
      /pending/
    );
  });
  test(`${kind}: signed checkout settlement validates quote and deduplicates; pending refund is not completed`, async () => {
    const row = await fixture(kind);
    row.checkout = {
      token: 'quote',
      pending: true,
      amountCents: 5000,
      currency: 'usd',
      createdAt: new Date(),
    };
    await row.save();
    const settlement = {
      kind,
      id: row.id,
      token: 'quote',
      sessionId: 'cs_test',
      amountCents: 5000,
      currency: 'usd',
      paymentIntentId: 'pi_test',
    };
    await assert.rejects(
      settleReservationCheckout({ ...settlement, amountCents: 1 }),
      /does not match/
    );
    await Promise.all([
      settleReservationCheckout(settlement),
      settleReservationCheckout(settlement),
    ]);
    let current = await (
      kind === 'dining' ? DiningReservation : ExperienceBooking
    ).findById(row.id);
    assert.equal(current.receipts.length, 1);
    assert.equal(current.isPaid, true);
    let calls = 0;
    const stripe: ReservationStripeGateway = {
      checkout: {
        sessions: {
          retrieve: async () => ({
            status: 'open',
            url: 'https://checkout.stripe.com/test',
          }),
          create: async () => ({
            id: 'cs_test',
            url: 'https://checkout.stripe.com/test',
          }),
        },
      },
      refunds: {
        create: async () => {
          calls++;
          return { id: 're_test', status: 'pending' };
        },
        retrieve: async () => ({ id: 're_test', status: 'succeeded' }),
      },
    };
    const refund = {
      kind,
      id: row.id,
      token: 'refund',
      amountCents: 5000,
      actor: 'manager',
      reference: 'Guest cancellation',
      stripe,
    };
    await refundReservationStripe(refund);
    current = await (
      kind === 'dining' ? DiningReservation : ExperienceBooking
    ).findById(row.id);
    assert.equal(reservationPaymentSummary(current).refundedCents, 0);
    await assert.rejects(
      refundReservationStripe({ ...refund, token: 'another' }),
      /pending/
    );
    await refundReservationStripe(refund);
    await refundReservationStripe(refund);
    current = await (
      kind === 'dining' ? DiningReservation : ExperienceBooking
    ).findById(row.id);
    assert.equal(reservationPaymentSummary(current).refundedCents, 5000);
    assert.equal(calls, 1);
  });
}

test('checkout enforces ownership, freezes the server balance, and recovers the same session after a connection failure', async () => {
  const row = await fixture('dining');
  await recordReservationReceipt({
    kind: 'dining',
    id: row.id,
    receipt: payment,
  });
  const keys: string[] = [];
  const stripe: ReservationStripeGateway = {
    checkout: {
      sessions: {
        retrieve: async () => ({
          status: 'open',
          url: 'https://checkout.stripe.com/test',
        }),
        create: async (params, options) => {
          keys.push(options.idempotencyKey);
          assert.equal(params.line_items[0].price_data.unit_amount, 2500);
          if (keys.length === 1) throw new Error('Connection lost');
          return { id: 'cs_test', url: 'https://checkout.stripe.com/test' };
        },
      },
    },
    refunds: {
      create: async () => ({ id: 'unused', status: 'failed' }),
      retrieve: async () => ({ id: 'unused', status: 'failed' }),
    },
  };
  const input = {
    kind: 'dining' as const,
    id: row.id,
    customer: 'guest',
    returnUrl: 'https://customer.test/dining/confirmation/test',
    stripe,
  };
  await assert.rejects(
    createReservationCheckout({ ...input, customer: 'someone-else' }),
    /not found/
  );
  await assert.rejects(createReservationCheckout(input), /Connection lost/);
  await assert.rejects(
    recordReservationReceipt({
      kind: 'dining',
      id: row.id,
      receipt: { ...payment, id: 'competing' },
    }),
    /pending/
  );
  assert.equal(
    await createReservationCheckout(input),
    'https://checkout.stripe.com/test'
  );
  assert.equal(
    await createReservationCheckout(input),
    'https://checkout.stripe.com/test'
  );
  assert.equal(keys.length, 2);
  assert.equal(keys[0], keys[1]);
});
