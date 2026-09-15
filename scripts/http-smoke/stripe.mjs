import ActualStripe from '__smoke_actual_stripe__';

// Test-only Stripe double. Requests are recorded by the loopback control server.
async function call(operation, input, options) {
  const response = await fetch(
    `${process.env.SMOKE_PROVIDER_URL}/stripe/${operation}`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-smoke-secret': process.env.SMOKE_SECRET,
      },
      body: JSON.stringify({ input, options }),
    }
  );
  if (!response.ok) throw new Error('Injected Stripe failure');
  return response.json();
}
export default class Stripe {
  webhooks = new ActualStripe('sk_test_smoke_only').webhooks;
  checkout = {
    sessions: {
      create: (input, options) => call('create', input, options),
      retrieve: input => call('retrieve', input),
    },
  };
  refunds = { create: (input, options) => call('refund', input, options) };
  paymentIntents = { retrieve: input => call('payment-intent', input) };
}
