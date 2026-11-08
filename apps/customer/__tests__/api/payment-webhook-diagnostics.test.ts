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
}));
jest.mock('@/lib/stripe', () => ({ getStripe: jest.fn() }));
jest.mock('@/lib/email', () => ({ sendPaymentConfirmationEmail: jest.fn() }));

import Stripe from 'stripe';
import { NextRequest } from 'next/server';
import { logger } from '@lodgeflow/database/logger';
import { connectDB, ProcessedStripeEvent } from '@lodgeflow/database';
import { POST } from '@/app/api/payments/webhook/route';
import { getStripe } from '@/lib/stripe';

const stripe = new Stripe('sk_test_diagnostic_fixture');
const secret = 'whsec_private_fixture';
const apiKey = 'sk_test_private_fixture';
const payload = JSON.stringify({
  id: 'evt_private_fixture',
  type: 'checkout.session.expired',
  data: { object: { metadata: {}, description: 'private_payment_details' } },
});
const now = 2_000_000_000;
const commit = 'a'.repeat(40);

function request({
  body = payload,
  signature = stripe.webhooks.generateTestHeaderString({
    payload: body,
    secret,
    timestamp: now,
  }),
}: { body?: string; signature?: string } = {}) {
  return new NextRequest('https://example.invalid/api/payments/webhook', {
    method: 'POST',
    body,
    headers: { 'stripe-signature': signature },
  });
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.replaceProperty(process, 'env', {
    ...process.env,
    STRIPE_SECRET_KEY: apiKey,
    STRIPE_WEBHOOK_SECRET: secret,
    VERCEL_GIT_COMMIT_SHA: commit,
    NEXT_RUNTIME: 'nodejs',
  });
  jest.spyOn(Date, 'now').mockReturnValue(now * 1000);
  jest.spyOn(logger, 'warn').mockImplementation(() => {});
  jest.mocked(getStripe).mockReturnValue(stripe);
  jest.mocked(ProcessedStripeEvent.exists).mockResolvedValue(null);
});
afterEach(() => jest.restoreAllMocks());

async function expectRejected(req: NextRequest) {
  const response = await POST(req);
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: 'Invalid signature' });
  expect(connectDB).not.toHaveBeenCalled();
  expect(ProcessedStripeEvent.updateOne).not.toHaveBeenCalled();
  return response;
}

function expectSafeDiagnostic({
  stage = 'signature',
  category,
  age = 0,
  overrides = {},
}: {
  stage?: string;
  category: string;
  age?: number | null;
  overrides?: object;
}) {
  expect(logger.warn).toHaveBeenCalledTimes(1);
  expect(logger.warn).toHaveBeenCalledWith(
    'Stripe webhook verification failed',
    {
      diagnosticVersion: 1,
      stage,
      category,
      apiKeyConfigured: true,
      webhookSecretConfigured: true,
      webhookSecretHasWhitespace: false,
      webhookSecretHasBoundaryQuotes: false,
      signatureHasV1: true,
      signatureTimestampAgeSeconds: age,
      deploymentCommit: commit,
      runtime: 'nodejs',
      ...overrides,
    }
  );
  const serialized = JSON.stringify(jest.mocked(logger.warn).mock.calls);
  for (const privateValue of [
    secret,
    apiKey,
    payload,
    'private_payment_details',
  ]) {
    expect(serialized).not.toContain(privateValue);
  }
}

it('classifies a real signature mismatch without logging its raw SDK error', async () => {
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: 'whsec_other_private_fixture',
    timestamp: now,
  });
  await expectRejected(request({ signature }));
  expectSafeDiagnostic({ category: 'signature_mismatch' });
  expect(JSON.stringify(jest.mocked(logger.warn).mock.calls)).not.toContain(
    signature
  );
});

it('classifies malformed signature headers without copying their values', async () => {
  await expectRejected(request({ signature: 'private_header_contents' }));
  expectSafeDiagnostic({
    category: 'malformed_signature',
    age: null,
    overrides: { signatureHasV1: false },
  });
  expect(JSON.stringify(jest.mocked(logger.warn).mock.calls)).not.toContain(
    'private_header_contents'
  );
});

it('distinguishes an expired signing timestamp from an HMAC mismatch', async () => {
  await expectRejected(
    request({
      signature: stripe.webhooks.generateTestHeaderString({
        payload,
        secret,
        timestamp: now - 301,
      }),
    })
  );
  expectSafeDiagnostic({ category: 'timestamp_outside_tolerance', age: 301 });
});

it('classifies signed invalid JSON without logging its content', async () => {
  await expectRejected(request({ body: 'private_invalid_json' }));
  expectSafeDiagnostic({ category: 'invalid_json' });
  expect(JSON.stringify(jest.mocked(logger.warn).mock.calls)).not.toContain(
    'private_invalid_json'
  );
});

it('separates SDK initialization failures and reports safe configuration checks', async () => {
  process.env.STRIPE_WEBHOOK_SECRET = ' "whsec_private_fixture" ';
  delete process.env.STRIPE_SECRET_KEY;
  jest.mocked(getStripe).mockImplementation(() => {
    throw new Error('private_initialization_error ' + apiKey);
  });
  await expectRejected(request());
  expectSafeDiagnostic({
    stage: 'stripe-client',
    category: 'stripe_initialization_failed',
    overrides: {
      apiKeyConfigured: false,
      webhookSecretHasWhitespace: true,
      webhookSecretHasBoundaryQuotes: true,
    },
  });
  expect(JSON.stringify(jest.mocked(logger.warn).mock.calls)).not.toContain(
    'private_initialization_error'
  );
});

it('separates request-body read failures without exposing their errors', async () => {
  const req = request();
  jest
    .spyOn(req, 'text')
    .mockRejectedValue(new Error('private_body_error ' + payload));
  await expectRejected(req);
  expectSafeDiagnostic({
    stage: 'request-body',
    category: 'request_body_unreadable',
  });
});

it('bounds untrusted metadata and never serializes unexpected thrown values', async () => {
  process.env.VERCEL_GIT_COMMIT_SHA = 'private_deployment_value';
  process.env.NEXT_RUNTIME = 'private_runtime_value';
  jest.spyOn(stripe.webhooks, 'constructEvent').mockImplementation(() => {
    throw { privateError: payload, signature: 'private_signature_value' };
  });
  await expectRejected(
    request({ signature: 't=999999999999999999999,v1=private_signature_value' })
  );
  expectSafeDiagnostic({
    category: 'verification_runtime_error',
    age: null,
    overrides: { deploymentCommit: null, runtime: 'unknown' },
  });
});

it('keeps the rejection unchanged if diagnostic logging itself fails', async () => {
  jest.mocked(logger.warn).mockImplementation(() => {
    throw new Error('log transport unavailable');
  });
  await expectRejected(request({ signature: 'invalid' }));
});

it('preserves valid signed processing without diagnostic warnings', async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ received: true });
  expect(connectDB).toHaveBeenCalledTimes(1);
  expect(ProcessedStripeEvent.updateOne).toHaveBeenCalledTimes(1);
  expect(logger.warn).not.toHaveBeenCalled();
});
