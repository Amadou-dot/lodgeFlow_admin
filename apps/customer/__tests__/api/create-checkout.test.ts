/** @jest-environment node */
import { Types } from 'mongoose';
import { NextRequest } from 'next/server';
import type Stripe from 'stripe';
import type { IBooking, ICabin } from '@lodgeflow/database';

type CheckoutBooking = Pick<
  IBooking,
  | 'customer'
  | 'status'
  | 'isPaid'
  | 'amountPaid'
  | 'remainingAmount'
  | 'depositAmount'
  | 'totalPrice'
  | 'checkoutPending'
  | 'checkoutToken'
  | 'checkoutAmount'
  | 'checkoutTotalPrice'
  | 'checkoutCurrency'
  | 'stripeSessionId'
> & {
  _id: Types.ObjectId;
  cabin: Pick<ICabin, 'name'> | null;
  get: (path: string) => number;
};
type CheckoutSession = Pick<Stripe.Checkout.Session, 'id' | 'url' | 'status'>;

const mockAuth = jest.fn<Promise<{ userId: string | null }>, []>();
const mockFindPopulate = jest.fn<Promise<CheckoutBooking | null>, [string]>();
const mockReservePopulate = jest.fn<
  Promise<CheckoutBooking | null>,
  [string]
>();
const mockFindOne = jest.fn<{ populate: typeof mockFindPopulate }, [unknown]>(
  () => ({ populate: mockFindPopulate })
);
const mockReserve = jest.fn<
  { populate: typeof mockReservePopulate },
  [unknown, unknown, unknown]
>(() => ({ populate: mockReservePopulate }));
const mockUpdate = jest.fn();
const mockConnect = jest.fn();
const mockSettings = jest.fn<Promise<{ currency: string }>, []>();
const mockCreateSession = jest.fn<
  Promise<CheckoutSession>,
  [Stripe.Checkout.SessionCreateParams, Stripe.RequestOptions]
>();
const mockRetrieveSession = jest.fn<Promise<CheckoutSession>, [string]>();
jest.mock('@clerk/nextjs/server', () => ({ auth: () => mockAuth() }));
jest.mock('@lodgeflow/database', () => ({
  connectDB: () => mockConnect(),
  Booking: {
    findOne: (...args: [unknown]) => mockFindOne(...args),
    findOneAndUpdate: (...args: [unknown, unknown, unknown]) =>
      mockReserve(...args),
    updateOne: (...args: unknown[]) => mockUpdate(...args),
  },
  Settings: { getSettings: () => mockSettings() },
}));
jest.mock('@/lib/stripe', () => ({
  getStripe: () => ({
    checkout: {
      sessions: { create: mockCreateSession, retrieve: mockRetrieveSession },
    },
  }),
}));
import { POST } from '@/app/api/payments/create-checkout/route';

const bookingId = '507f1f77bcf86cd7994390ab';
const session: CheckoutSession = {
  id: 'cs_checkout',
  url: 'https://checkout.stripe.invalid/session',
  status: 'open',
};
function booking(overrides: Partial<CheckoutBooking> = {}): CheckoutBooking {
  return {
    _id: new Types.ObjectId(bookingId),
    customer: 'customer',
    cabin: { name: 'Pine Cabin' },
    status: 'confirmed',
    isPaid: false,
    amountPaid: 25,
    remainingAmount: 275.5,
    depositAmount: 75.25,
    totalPrice: 300.5,
    checkoutPending: false,
    get: () => 4,
    ...overrides,
  };
}
function reserved(overrides: Partial<CheckoutBooking> = {}): CheckoutBooking {
  return booking({
    checkoutPending: true,
    checkoutToken: 'retained-quote',
    checkoutAmount: 50.25,
    checkoutTotalPrice: 300.5,
    checkoutCurrency: 'usd',
    ...overrides,
  });
}
function request(body: object = { bookingId }) {
  return new NextRequest('http://localhost/api/payments/create-checkout', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
function expectNoWritesOrProviderCalls() {
  expect(mockReserve).not.toHaveBeenCalled();
  expect(mockUpdate).not.toHaveBeenCalled();
  expect(mockCreateSession).not.toHaveBeenCalled();
  expect(mockRetrieveSession).not.toHaveBeenCalled();
}

const originalOrigin = process.env.NEXT_PUBLIC_APP_URL;
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  process.env.NEXT_PUBLIC_APP_URL = 'https://lodgeflow.app/';
  mockAuth.mockResolvedValue({ userId: 'customer' });
  mockFindPopulate.mockResolvedValue(booking());
  mockReservePopulate.mockResolvedValue(reserved());
  mockSettings.mockResolvedValue({ currency: 'USD' });
  mockCreateSession.mockResolvedValue(session);
  mockRetrieveSession.mockResolvedValue(session);
});
afterEach(() => {
  jest.restoreAllMocks();
  if (originalOrigin === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = originalOrigin;
});

describe('checkout characterization', () => {
  test('keeps epsilon rounding when reserving a fractional deposit quote', async () => {
    mockFindPopulate.mockResolvedValue(
      booking({ amountPaid: 0, depositAmount: 1.005 })
    );
    mockReservePopulate.mockResolvedValue(reserved({ checkoutAmount: 1.01 }));
    expect((await POST(request())).status).toBe(200);
    expect(mockReserve).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({ checkoutAmount: 1.01 }),
      }),
      expect.anything()
    );
    expect(
      mockCreateSession.mock.calls[0][0].line_items?.[0].price_data?.unit_amount
    ).toBe(101);
  });

  test('reserves the server-calculated deposit and preserves the Stripe payload and response', async () => {
    const response = await POST(
      request({ bookingId, amount: 1, currency: 'eur', userId: 'foreign' })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: { url: session.url },
    });
    expect(mockFindOne).toHaveBeenCalledWith({
      _id: bookingId,
      customer: 'customer',
    });
    expect(mockReserve).toHaveBeenCalledWith(
      { _id: bookingId, __v: 4, checkoutPending: false },
      {
        $set: {
          checkoutPending: true,
          checkoutToken: expect.any(String),
          checkoutAmount: 50.25,
          checkoutTotalPrice: 300.5,
          checkoutCurrency: 'usd',
        },
        $unset: { stripeSessionId: 1 },
        $inc: { __v: 1 },
      },
      { new: true }
    );
    expect(mockCreateSession).toHaveBeenCalledWith(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              unit_amount: 5025,
              product_data: {
                name: 'Pine Cabin',
                description: 'Booking deposit',
              },
            },
            quantity: 1,
          },
        ],
        metadata: {
          bookingId,
          userId: 'customer',
          isDeposit: 'true',
          quoteToken: 'retained-quote',
        },
        payment_intent_data: {
          metadata: {
            bookingId,
            userId: 'customer',
            quoteToken: 'retained-quote',
          },
        },
        success_url: `https://lodgeflow.app/payments/success?session_id={CHECKOUT_SESSION_ID}&booking_id=${bookingId}`,
        cancel_url: `https://lodgeflow.app/payments/cancel?booking_id=${bookingId}`,
      },
      { idempotencyKey: `booking:${bookingId}:retained-quote` }
    );
    expect(mockUpdate).toHaveBeenCalledWith(
      {
        _id: bookingId,
        checkoutToken: 'retained-quote',
        checkoutPending: true,
      },
      { $set: { stripeSessionId: session.id }, $inc: { __v: 1 } }
    );
  });

  test.each([
    {
      label: 'paid deposit',
      amountPaid: 75.25,
      depositAmount: 75.25,
      remainingAmount: 225.25,
      amount: 225.25,
      description: 'Booking balance',
    },
    {
      label: 'no required deposit',
      amountPaid: 0,
      depositAmount: 0,
      remainingAmount: 300.5,
      amount: 300.5,
      description: 'Booking balance',
    },
    {
      label: 'deposit capped by balance',
      amountPaid: 25,
      depositAmount: 75.25,
      remainingAmount: 20.5,
      amount: 20.5,
      description: 'Booking deposit',
    },
  ])(
    'preserves amount selection: $label',
    async ({ amount, description, ...fields }) => {
      mockFindPopulate.mockResolvedValue(booking(fields));
      mockReservePopulate.mockResolvedValue(
        reserved({ ...fields, checkoutAmount: amount })
      );
      expect((await POST(request())).status).toBe(200);
      expect(mockReserve).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          $set: expect.objectContaining({ checkoutAmount: amount }),
        }),
        expect.anything()
      );
      expect(mockCreateSession.mock.calls[0][0].line_items).toEqual([
        {
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(amount * 100),
            product_data: { name: 'Pine Cabin', description },
          },
          quantity: 1,
        },
      ]);
    }
  );

  test('uses the request origin when no app origin is configured', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect((await POST(request())).status).toBe(200);
    expect(mockCreateSession.mock.calls[0][0].cancel_url).toBe(
      `http://localhost/payments/cancel?booking_id=${bookingId}`
    );
  });

  test('rejects unauthenticated requests before database access', async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Authentication required',
    });
    expect(mockConnect).not.toHaveBeenCalled();
    expectNoWritesOrProviderCalls();
  });

  test.each([{}, { bookingId: 'invalid' }, { bookingId: { $ne: null } }])(
    'rejects invalid identifiers: %j',
    async body => {
      const response = await POST(request(body));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        success: false,
        error: 'Invalid booking ID',
      });
      expect(mockConnect).not.toHaveBeenCalled();
      expectNoWritesOrProviderCalls();
    }
  );

  test('returns the existing 404 for an absent owner-scoped booking', async () => {
    mockFindPopulate.mockResolvedValue(null);
    const response = await POST(request());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Booking not found',
    });
    expect(mockFindOne).toHaveBeenCalledWith({
      _id: bookingId,
      customer: 'customer',
    });
    expectNoWritesOrProviderCalls();
  });

  test.each([{ isPaid: true }, { status: 'cancelled' as const }])(
    'rejects an unpayable booking: %j',
    async fields => {
      mockFindPopulate.mockResolvedValue(booking(fields));
      const response = await POST(request());
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        success: false,
        error: 'Booking is not payable',
      });
      expectNoWritesOrProviderCalls();
    }
  );

  test('does not reserve a quote when no payment is due', async () => {
    mockFindPopulate.mockResolvedValue(booking({ remainingAmount: 0 }));
    const response = await POST(request());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      error: 'No payment is due',
    });
    expectNoWritesOrProviderCalls();
  });

  test('rejects a lost quote reservation without creating a Stripe session', async () => {
    mockReservePopulate.mockResolvedValue(null);
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Booking changed; refresh and try again',
    });
    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test('reuses an open session without reserving or creating another', async () => {
    mockFindPopulate.mockResolvedValue(
      reserved({ stripeSessionId: session.id })
    );
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: { url: session.url },
    });
    expect(mockRetrieveSession).toHaveBeenCalledWith(session.id);
    expect(mockReserve).not.toHaveBeenCalled();
    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test('releases only the matching expired session and returns the existing retry response', async () => {
    mockFindPopulate.mockResolvedValue(
      reserved({ stripeSessionId: session.id })
    );
    mockRetrieveSession.mockResolvedValue({ ...session, status: 'expired' });
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Checkout expired; please try again',
    });
    expect(mockUpdate).toHaveBeenCalledWith(
      {
        _id: bookingId,
        checkoutToken: 'retained-quote',
        checkoutPending: true,
      },
      {
        $set: { checkoutPending: false },
        $unset: { stripeSessionId: 1 },
        $inc: { __v: 1 },
      }
    );
    expect(mockReserve).not.toHaveBeenCalled();
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  test.each<CheckoutSession>([
    { ...session, status: 'complete' },
    { ...session, url: null },
  ])('keeps a session awaiting confirmation: %j', async existing => {
    mockFindPopulate.mockResolvedValue(
      reserved({ stripeSessionId: session.id })
    );
    mockRetrieveSession.mockResolvedValue(existing);
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Payment is being confirmed; refresh shortly',
    });
    expect(mockReserve).not.toHaveBeenCalled();
    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test('retries the retained amount, currency and idempotency key after provider failure', async () => {
    const row = reserved({ checkoutCurrency: 'cad', checkoutAmount: 42.15 });
    const before = JSON.stringify(row);
    mockFindPopulate.mockResolvedValue(row);
    mockCreateSession.mockRejectedValueOnce(
      new Error('private provider details')
    );
    const failed = await POST(request());
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({
      success: false,
      error: 'Failed to create checkout session',
    });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect((await POST(request())).status).toBe(200);
    expect(mockCreateSession.mock.calls[1]).toEqual(
      mockCreateSession.mock.calls[0]
    );
    expect(
      mockCreateSession.mock.calls[1][0].line_items?.[0].price_data
    ).toMatchObject({ currency: 'cad', unit_amount: 4215 });
    expect(mockReserve).not.toHaveBeenCalled();
    expect(JSON.stringify(row)).toBe(before);
  });

  test('a failed session lookup keeps the quote and does not create another session', async () => {
    mockFindPopulate.mockResolvedValue(
      reserved({ stripeSessionId: session.id })
    );
    mockRetrieveSession.mockRejectedValueOnce(
      new Error('private provider details')
    );
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Failed to create checkout session',
    });
    expect(mockReserve).not.toHaveBeenCalled();
    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe('missing cabin regression', () => {
  test.each([
    booking({ cabin: null }),
    reserved({ cabin: null }),
    reserved({ cabin: null, stripeSessionId: session.id }),
  ])(
    'rejects a missing cabin before quote or provider side effects: %j',
    async row => {
      const before = JSON.stringify(row);
      mockFindPopulate.mockResolvedValue(row);
      const response = await POST(request());
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        success: false,
        error: 'Cabin not found',
      });
      expectNoWritesOrProviderCalls();
      expect(JSON.stringify(row)).toBe(before);
    }
  );

  test('does not create a session if the cabin disappears during quote reservation', async () => {
    mockReservePopulate.mockResolvedValue(reserved({ cabin: null }));
    const response = await POST(request());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Cabin not found',
    });
    expect(mockCreateSession).not.toHaveBeenCalled();
    // Keep the already-reserved quote, just as on a failed provider request.
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

function rawRequest(body: string) {
  return new NextRequest('http://localhost/api/payments/create-checkout', {
    method: 'POST',
    body,
  });
}

describe('checkout input characterization', () => {
  test.each([
    new Error('Request stream unavailable'),
    new SyntaxError('Request stream unavailable'),
  ])('keeps body-stream failures as safe server errors: %s', async failure => {
    const input = new NextRequest(
      'http://localhost/api/payments/create-checkout',
      {
        method: 'POST',
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.error(failure);
          },
        }),
        duplex: 'half',
      }
    );
    const response = await POST(input);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Failed to create checkout session',
    });
    expect(mockConnect).not.toHaveBeenCalled();
    expectNoWritesOrProviderCalls();
  });
  test.each(['{', 'null'])('auth denial precedes parsing %s', async body => {
    mockAuth.mockResolvedValue({ userId: null });
    const response = await POST(rawRequest(body));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Authentication required',
    });
    expect(mockConnect).not.toHaveBeenCalled();
    expect(mockFindOne).not.toHaveBeenCalled();
    expectNoWritesOrProviderCalls();
  });

  test('preserves uppercase hexadecimal IDs and ignores client-supplied pricing fields', async () => {
    const uppercaseId = bookingId.toUpperCase();
    const response = await POST(
      request({ bookingId: uppercaseId, amount: 1, customer: 'foreign' })
    );
    expect(response.status).toBe(200);
    expect(mockFindOne).toHaveBeenCalledWith({
      _id: uppercaseId,
      customer: 'customer',
    });
    expect(await response.json()).toEqual({
      success: true,
      data: { url: session.url },
    });
    expect(
      mockCreateSession.mock.calls[0][0].line_items?.[0].price_data?.unit_amount
    ).toBe(5025);
  });

  test.each([
    '[]',
    'true',
    '"booking"',
    '42',
    '{"bookingId":null}',
    '{"bookingId":""}',
  ])('retains the invalid-ID response for %s', async body => {
    const response = await POST(rawRequest(body));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Invalid booking ID',
    });
    expect(mockConnect).not.toHaveBeenCalled();
    expectNoWritesOrProviderCalls();
  });
});

describe('checkout input regressions', () => {
  test.each([
    { remainingAmount: NaN },
    { depositAmount: Infinity },
    { amountPaid: -1 },
    { totalPrice: Number.MAX_SAFE_INTEGER },
  ])(
    'rejects invalid booking money %j before reserving a quote or calling Stripe',
    async fields => {
      mockFindPopulate.mockResolvedValue(booking(fields));
      const response = await POST(request());
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        success: false,
        error: 'Failed to create checkout session',
      });
      expectNoWritesOrProviderCalls();
    }
  );

  test.each([NaN, Infinity, -1, 1.005, Number.MAX_SAFE_INTEGER])(
    'rejects invalid reserved checkout amount %s without creating a Stripe session',
    async checkoutAmount => {
      mockFindPopulate.mockResolvedValue(reserved({ checkoutAmount }));
      const response = await POST(request());
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        success: false,
        error: 'Failed to create checkout session',
      });
      expectNoWritesOrProviderCalls();
    }
  );

  test.each(['', '{', '{"bookingId":'])(
    'rejects malformed JSON %j before database or provider access',
    async body => {
      const response = await POST(rawRequest(body));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        success: false,
        error: 'Invalid JSON body',
      });
      expect(mockConnect).not.toHaveBeenCalled();
      expect(mockFindOne).not.toHaveBeenCalled();
      expectNoWritesOrProviderCalls();
    }
  );

  test.each(['null', '{"bookingId":0}', '{"bookingId":42}'])(
    'rejects non-object bodies and non-string IDs in %s',
    async body => {
      const response = await POST(rawRequest(body));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        success: false,
        error: 'Invalid booking ID',
      });
      expect(mockConnect).not.toHaveBeenCalled();
      expect(mockFindOne).not.toHaveBeenCalled();
      expectNoWritesOrProviderCalls();
    }
  );
});
