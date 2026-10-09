/** @jest-environment node */
import { NextRequest } from 'next/server';
import { Error as MongooseError, Types } from 'mongoose';
import BookingModel from '@lodgeflow/database/models/Booking';
import type { IBooking } from '@lodgeflow/database';
import type { BookingReadSource } from '@lodgeflow/database/booking-json';
import { majorAmount } from '@lodgeflow/database/money';
import type { createRefund } from '@/lib/stripe';

type CancellationBooking = BookingReadSource &
  Pick<
    IBooking,
    | 'amountPaid'
    | 'payments'
    | 'cancellationRefunds'
    | 'checkoutPending'
    | 'refundStatus'
  > & {
    cabin: null;
    save: jest.Mock<Promise<void>, []>;
  };
const mockAuth = jest.fn();
const mockPopulate = jest.fn<Promise<CancellationBooking | null>, []>();
const mockUpdate = jest.fn();
const mockSettings = jest.fn();
const mockRefund = jest.fn<
  ReturnType<typeof createRefund>,
  Parameters<typeof createRefund>
>();
const events: string[] = [];
jest.mock('@clerk/nextjs/server', () => ({ auth: () => mockAuth() }));
jest.mock('@lodgeflow/database', () => ({
  ...jest.requireActual<typeof import('@lodgeflow/database')>(
    '@lodgeflow/database'
  ),
  connectDB: jest.fn(),
  Booking: {
    findById: () => ({ populate: () => mockPopulate() }),
    updateOne: (...args: unknown[]) => mockUpdate(...args),
  },
  Settings: { getSettings: () => mockSettings() },
}));
jest.mock('@/lib/stripe', () => ({
  createRefund: (...args: Parameters<typeof createRefund>) =>
    mockRefund(...args),
}));
jest.mock('@/lib/email', () => ({
  sendCancellationConfirmationEmail: jest.fn(),
}));
import { DELETE } from '@/app/api/bookings/[id]/route';

const id = '507f1f77bcf86cd799439011';
const now = new Date('2030-02-01T12:00:00.000Z');
function booking(
  overrides: Partial<CancellationBooking> = {}
): CancellationBooking {
  return {
    _id: new Types.ObjectId(id),
    customer: 'owner',
    cabin: null,
    checkInDate: new Date('2030-02-15T12:00:00.000Z'),
    checkOutDate: new Date('2030-02-17T12:00:00.000Z'),
    numNights: 2,
    numGuests: 2,
    cabinPrice: 35.29,
    totalPrice: 35.29,
    amountPaid: 35.29,
    refundAmount: 0.29,
    status: 'confirmed',
    checkoutPending: false,
    refundStatus: 'partial',
    cancellationRefunds: [],
    payments: [
      {
        id: 'first',
        paymentIntentId: 'pi_first',
        amount: 10.29,
        refundedAmount: 0.29,
        method: 'online',
        receivedAt: now,
      },
      {
        id: 'second',
        paymentIntentId: 'pi_second',
        amount: 20,
        method: 'online',
        receivedAt: now,
      },
      { id: 'offline', amount: 5, method: 'cash', receivedAt: now },
    ],
    save: jest.fn(async () => {
      events.push('save');
    }),
    ...overrides,
  };
}
const cancel = () =>
  DELETE(
    new NextRequest('https://lodgeflow.app/api/bookings/' + id, {
      method: 'DELETE',
    }),
    { params: Promise.resolve({ id }) }
  );

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(now);
  jest.spyOn(console, 'error').mockImplementation(() => {});
  events.length = 0;
  mockAuth.mockResolvedValue({ userId: 'owner' });
  mockSettings.mockResolvedValue({ cancellationPolicy: 'flexible' });
  mockUpdate.mockImplementation(async () => {
    events.push('record');
  });
  mockRefund.mockImplementation(async ({ paymentIntentId, amount }) => {
    events.push(paymentIntentId);
    return {
      success: true,
      refundId: 're_' + paymentIntentId,
      amount: majorAmount(amount ?? 0, { precision: 'exact' }),
    };
  });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('saves a multi-receipt refund plan before Stripe and leaves offline money pending', async () => {
  const source = booking();
  mockPopulate.mockResolvedValue(source);
  const response = await cancel();
  expect(response.status).toBe(200);
  expect(source.cancellationRefunds).toEqual([
    { paymentIntentId: 'pi_first', amount: 10 },
    { paymentIntentId: 'pi_second', amount: 20 },
  ]);
  expect(events).toEqual(['save', 'pi_first', 'record', 'pi_second', 'record']);
  expect(source.refundRequestedAmount).toBe(35);
  expect(source.refundAmount).toBe(0.29);
  expect(await response.json()).toMatchObject({
    success: true,
    data: { refund: { amount: 35, status: 'pending' } },
  });
  expect(mockRefund).toHaveBeenNthCalledWith(1, {
    paymentIntentId: 'pi_first',
    amount: 10,
    idempotencyKey: `cancel:${id}:pi_first`,
  });
  expect(mockRefund).toHaveBeenNthCalledWith(2, {
    paymentIntentId: 'pi_second',
    amount: 20,
    idempotencyKey: `cancel:${id}:pi_second`,
  });
});

test('reuses the saved refund plan after provider failure without recalculating policy', async () => {
  const source = booking({
    status: 'cancelled',
    cancelledAt: now,
    refundRequestedAmount: 1,
    refundStatus: 'pending',
    cancellationRefunds: [
      { paymentIntentId: 'pi_first', amount: 10, refundId: 're_done' },
      { paymentIntentId: 'pi_second', amount: 1 },
    ],
  });
  mockPopulate.mockResolvedValue(source);
  mockRefund.mockResolvedValueOnce({
    success: false,
    error: 'Failed to create refund',
  });
  const failure = await cancel();
  expect(failure.status).toBe(200);
  expect(await failure.json()).toMatchObject({
    success: true,
    data: {
      refund: {
        amount: 1,
        status: 'pending',
        error: 'Failed to create refund',
      },
    },
  });
  expect(source.save).not.toHaveBeenCalled();
  expect(mockUpdate).not.toHaveBeenCalled();
  expect((await cancel()).status).toBe(200);
  expect(mockRefund).toHaveBeenCalledTimes(2);
  expect(mockRefund).toHaveBeenNthCalledWith(1, {
    paymentIntentId: 'pi_second',
    amount: 1,
    idempotencyKey: `cancel:${id}:pi_second`,
  });
  expect(mockRefund).toHaveBeenNthCalledWith(2, {
    paymentIntentId: 'pi_second',
    amount: 1,
    idempotencyKey: `cancel:${id}:pi_second`,
  });
});

test('does not contact Stripe after cancellation loses the version comparison', async () => {
  const source = booking();
  source.save.mockRejectedValue(
    new MongooseError.VersionError(new BookingModel(), 0, ['status'])
  );
  mockPopulate.mockResolvedValue(source);
  const response = await cancel();
  expect(response.status).toBe(409);
  expect(mockRefund).not.toHaveBeenCalled();
  expect(mockUpdate).not.toHaveBeenCalled();
});

test.each([NaN, Infinity, -1, 1.005, Number.MAX_SAFE_INTEGER])(
  'rejects invalid receipt money %s before persisting a cancellation or contacting Stripe',
  async amount => {
    const source = booking();
    source.payments[0].amount = amount;
    mockPopulate.mockResolvedValue(source);
    const response = await cancel();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Failed to cancel booking',
    });
    expect(source.save).not.toHaveBeenCalled();
    expect(mockRefund).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  }
);

test.each([NaN, Infinity, -1, 1.005, Number.MAX_SAFE_INTEGER])(
  'rejects invalid persisted refund plan money %s before contacting Stripe',
  async amount => {
    const source = booking({
      status: 'cancelled',
      cancelledAt: now,
      refundRequestedAmount: 1,
      refundStatus: 'pending',
      cancellationRefunds: [{ paymentIntentId: 'pi_first', amount }],
    });
    mockPopulate.mockResolvedValue(source);
    const response = await cancel();
    expect(response.status).toBe(500);
    expect(source.save).not.toHaveBeenCalled();
    expect(mockRefund).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  }
);
