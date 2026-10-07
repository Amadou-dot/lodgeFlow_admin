/** @jest-environment node */
import { createRefund } from '@/lib/stripe';
import { logger } from '@lodgeflow/database/logger';
const mockRefund = jest.fn();
jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    refunds: { create: (...args: unknown[]) => mockRefund(...args) },
  })),
}));
const originalKey = process.env.STRIPE_SECRET_KEY;
beforeEach(() => {
  jest.clearAllMocks();
  process.env.STRIPE_SECRET_KEY = 'sk_test_local';
});
afterEach(() => {
  if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = originalKey;
  jest.restoreAllMocks();
});
test('retains major-unit refund amounts and the provider idempotency key', async () => {
  mockRefund.mockResolvedValue({ id: 're_local', amount: 1234 });
  expect(
    await createRefund({
      paymentIntentId: 'pi_local',
      amount: 12.34,
      idempotencyKey: 'cancel:booking:pi_local',
    })
  ).toEqual({ success: true, refundId: 're_local', amount: 12.34 });
  expect(mockRefund).toHaveBeenCalledWith(
    { payment_intent: 'pi_local', amount: 1234 },
    { idempotencyKey: 'cancel:booking:pi_local' }
  );
});
test('keeps optional full-refund amounts absent at the provider boundary', async () => {
  mockRefund.mockResolvedValue({ id: 're_local', amount: 10000 });
  expect(await createRefund({ paymentIntentId: 'pi_local' })).toEqual({
    success: true,
    refundId: 're_local',
    amount: 100,
  });
  expect(mockRefund).toHaveBeenCalledWith(
    { payment_intent: 'pi_local' },
    undefined
  );
});
test('logs a provider failure and returns a safe failed result', async () => {
  const failure = new Error('private provider details');
  mockRefund.mockRejectedValue(failure);
  const logged = jest.spyOn(logger, 'error').mockImplementation(() => {});
  expect(
    await createRefund({ paymentIntentId: 'pi_local', amount: 12.34 })
  ).toEqual({ success: false, error: 'Failed to create refund' });
  expect(logged).toHaveBeenCalledWith('Stripe refund error', failure);
});
