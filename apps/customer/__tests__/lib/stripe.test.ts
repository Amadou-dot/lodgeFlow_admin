/** @jest-environment node */
import { createCheckoutSession, createRefund } from '@/lib/stripe';
import { logger } from '@lodgeflow/database/logger';
import { MoneyError } from '@lodgeflow/database/money';
const mockRefund = jest.fn();
const mockCheckout = jest.fn();
jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    refunds: { create: (...args: unknown[]) => mockRefund(...args) },
    checkout: {
      sessions: { create: (...args: unknown[]) => mockCheckout(...args) },
    },
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

const checkout = {
  bookingId: 'booking',
  isDeposit: true,
  customerEmail: 'customer@example.com',
  cabinName: 'Pine',
  checkInDate: '2030-02-01',
  checkOutDate: '2030-02-03',
  successUrl: 'https://lodgeflow.app/success',
  cancelUrl: 'https://lodgeflow.app/cancel',
};

test.each([
  { amount: 0.29, cents: 29 },
  { amount: 1.005, cents: 100 },
  { amount: 1.006, cents: 101 },
])(
  'checkout keeps ordinary nearest-cent rounding for $amount',
  async ({ amount, cents }) => {
    mockCheckout.mockResolvedValue({ id: 'cs_local' });
    await expect(
      createCheckoutSession({ ...checkout, amount })
    ).resolves.toEqual({ id: 'cs_local' });
    expect(mockCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({ unit_amount: cents }),
          }),
        ],
      })
    );
  }
);

test.each([NaN, Infinity, -1, 0, Number.MAX_SAFE_INTEGER])(
  'rejects invalid checkout amount %s before calling Stripe',
  async amount => {
    await expect(
      createCheckoutSession({ ...checkout, amount })
    ).rejects.toBeInstanceOf(MoneyError);
    expect(mockCheckout).not.toHaveBeenCalled();
  }
);

test.each([NaN, Infinity, -1, 0, 1.005, Number.MAX_SAFE_INTEGER])(
  'rejects invalid explicit refund %s without calling Stripe',
  async amount => {
    jest.spyOn(logger, 'error').mockImplementation(() => {});
    mockRefund.mockResolvedValue({ id: 're_invalid', amount: 100 });
    expect(await createRefund({ paymentIntentId: 'pi_local', amount })).toEqual(
      { success: false, error: 'Failed to create refund' }
    );
    expect(mockRefund).not.toHaveBeenCalled();
  }
);

test.each([NaN, Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
  'rejects malformed provider refund cents %s instead of returning a successful amount',
  async amount => {
    jest.spyOn(logger, 'error').mockImplementation(() => {});
    mockRefund.mockResolvedValue({ id: 're_invalid', amount });
    expect(
      await createRefund({ paymentIntentId: 'pi_local', amount: 12.34 })
    ).toEqual({ success: false, error: 'Failed to create refund' });
  }
);
