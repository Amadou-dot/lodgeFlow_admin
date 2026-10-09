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
  ReservationRuleError,
  settleReservationRefund,
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
    let current =
      kind === 'dining'
        ? await DiningReservation.findById(row.id).orFail()
        : await ExperienceBooking.findById(row.id).orFail();
    assert.equal(current.receipts.length, 1);
    assert.equal(current.isPaid, true);
    for (const mismatch of [
      { amountCents: 4999 },
      { currency: 'eur' },
      { token: 'different-quote' },
      { paymentIntentId: 'different-intent' },
    ]) {
      await assert.rejects(
        settleReservationCheckout({ ...settlement, ...mismatch }),
        error => error instanceof ReservationRuleError && error.status === 409
      );
    }
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
    current =
      kind === 'dining'
        ? await DiningReservation.findById(row.id).orFail()
        : await ExperienceBooking.findById(row.id).orFail();
    assert.equal(reservationPaymentSummary(current).refundedCents, 0);
    await assert.rejects(
      refundReservationStripe({ ...refund, token: 'another' }),
      /pending/
    );
    await refundReservationStripe(refund);
    await refundReservationStripe(refund);
    current =
      kind === 'dining'
        ? await DiningReservation.findById(row.id).orFail()
        : await ExperienceBooking.findById(row.id).orFail();
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

test('unsafe saved quotes cannot create or retrieve a checkout or write a receipt', async () => {
  let providerCalls = 0;
  const stripe: ReservationStripeGateway = {
    checkout: {
      sessions: {
        create: async () => {
          providerCalls++;
          return { id: 'cs_invalid', url: 'https://checkout.test' };
        },
        retrieve: async () => {
          providerCalls++;
          return { status: 'open', url: 'https://checkout.test' };
        },
      },
    },
    refunds: {
      create: async () => {
        throw new Error('Unexpected refund');
      },
      retrieve: async () => {
        throw new Error('Unexpected refund');
      },
    },
  };
  for (const amountCents of [
    0,
    -1,
    1.5,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    for (const sessionId of [undefined, 'cs_invalid']) {
      const row = await fixture('dining');
      row.checkout = {
        token: 'quote',
        amountCents,
        currency: 'usd',
        pending: true,
        createdAt: new Date(),
        sessionId,
      };
      await row.save();
      const beforeRow = await DiningReservation.findById(row.id).lean();
      await assert.rejects(
        createReservationCheckout({
          kind: 'dining',
          id: row.id,
          customer: 'guest',
          returnUrl: 'https://customer.test',
          stripe,
        }),
        ReservationRuleError
      );
      await assert.rejects(
        settleReservationCheckout({
          kind: 'dining',
          id: row.id,
          token: 'quote',
          sessionId: 'cs_invalid',
          amountCents,
          currency: 'usd',
          paymentIntentId: 'pi_invalid',
        }),
        ReservationRuleError
      );
      assert.deepEqual(
        await DiningReservation.findById(row.id).lean(),
        beforeRow
      );
    }
  }
  assert.equal(providerCalls, 0);
});

test('invalid provider cents and overflowing stored receipts never settle a payment', async () => {
  const row = await fixture('dining');
  row.checkout = {
    token: 'quote',
    amountCents: 5000,
    currency: 'usd',
    pending: true,
    createdAt: new Date(),
  };
  await row.save();
  const settlement = {
    kind: 'dining' as const,
    id: row.id,
    token: 'quote',
    sessionId: 'cs_invalid',
    amountCents: 5000,
    currency: 'usd',
    paymentIntentId: 'pi_invalid',
  };
  for (const amountCents of [
    NaN,
    Infinity,
    -1,
    0,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    await assert.rejects(
      settleReservationCheckout({ ...settlement, amountCents }),
      ReservationRuleError
    );
  }
  row.receipts = [
    {
      ...payment,
      amountCents: Number.MAX_SAFE_INTEGER,
      recordedAt: new Date(),
    },
    { ...payment, id: 'another', amountCents: 1, recordedAt: new Date() },
  ];
  await row.save();
  const beforeRow = await DiningReservation.findById(row.id).lean();
  await assert.rejects(
    settleReservationCheckout(settlement),
    ReservationRuleError
  );
  assert.deepEqual(await DiningReservation.findById(row.id).lean(), beforeRow);
});

test('invalid refund reservations cannot call the provider or complete refund settlement', async () => {
  let providerCalls = 0;
  const stripe: ReservationStripeGateway = {
    checkout: {
      sessions: {
        create: async () => {
          throw new Error('Unexpected checkout');
        },
        retrieve: async () => {
          throw new Error('Unexpected checkout');
        },
      },
    },
    refunds: {
      create: async () => {
        providerCalls++;
        return { id: 're_invalid', status: 'succeeded' };
      },
      retrieve: async () => {
        providerCalls++;
        return { id: 're_invalid', status: 'succeeded' };
      },
    },
  };
  for (const amountCents of [
    0,
    -1,
    1.5,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    const row = await fixture('dining');
    row.receipts = [
      {
        ...payment,
        method: 'stripe',
        amountCents: 5000,
        recordedAt: new Date(),
      },
    ];
    row.stripePaymentIntentId = 'pi_paid';
    row.stripeRefund = {
      token: 'refund',
      amountCents,
      status: 'pending',
      createdAt: new Date(),
      actor: 'staff',
      reference: 'Cancel',
    };
    await row.save();
    const beforeRow = await DiningReservation.findById(row.id).lean();
    await assert.rejects(
      refundReservationStripe({
        kind: 'dining',
        id: row.id,
        token: 'refund',
        amountCents: 5000,
        actor: 'staff',
        reference: 'Cancel',
        stripe,
      }),
      ReservationRuleError
    );
    await assert.rejects(
      settleReservationRefund({
        kind: 'dining',
        id: row.id,
        token: 'refund',
        refundId: 're_invalid',
        status: 'succeeded',
      }),
      ReservationRuleError
    );
    assert.deepEqual(
      await DiningReservation.findById(row.id).lean(),
      beforeRow
    );
  }
  assert.equal(providerCalls, 0);
});

test('a saved refund that exceeds available receipts fails before contacting Stripe', async () => {
  const row = await fixture('dining');
  row.receipts = [
    { ...payment, method: 'stripe', amountCents: 5000, recordedAt: new Date() },
  ];
  row.stripePaymentIntentId = 'pi_paid';
  row.stripeRefund = {
    token: 'refund',
    amountCents: 5001,
    status: 'pending',
    createdAt: new Date(),
    actor: 'staff',
    reference: 'Cancel',
  };
  await row.save();
  let providerCalls = 0;
  const stripe: ReservationStripeGateway = {
    checkout: {
      sessions: {
        create: async () => {
          throw new Error('Unexpected checkout');
        },
        retrieve: async () => {
          throw new Error('Unexpected checkout');
        },
      },
    },
    refunds: {
      create: async () => {
        providerCalls++;
        return { id: 're_invalid', status: 'succeeded' };
      },
      retrieve: async () => {
        providerCalls++;
        return { id: 're_invalid', status: 'succeeded' };
      },
    },
  };
  const beforeRow = await DiningReservation.findById(row.id).lean();
  await assert.rejects(
    refundReservationStripe({
      kind: 'dining',
      id: row.id,
      token: 'refund',
      amountCents: 5001,
      actor: 'staff',
      reference: 'Cancel',
      stripe,
    }),
    ReservationRuleError
  );
  await assert.rejects(
    settleReservationRefund({
      kind: 'dining',
      id: row.id,
      token: 'refund',
      refundId: 're_invalid',
      status: 'succeeded',
    }),
    ReservationRuleError
  );
  assert.equal(providerCalls, 0);
  assert.deepEqual(await DiningReservation.findById(row.id).lean(), beforeRow);
});
