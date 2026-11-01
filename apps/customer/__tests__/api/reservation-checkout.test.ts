/** @jest-environment node */
import { NextRequest } from 'next/server';
import type { createReservationCheckout } from '@lodgeflow/database';

const mockAuth = jest.fn<Promise<{ userId: string | null }>, []>();
const mockConnect = jest.fn();
const mockCheckout = jest.fn<
  ReturnType<typeof createReservationCheckout>,
  Parameters<typeof createReservationCheckout>
>();
const mockGetStripe = jest.fn();
const mockLoggerError = jest.fn();

jest.mock('@clerk/nextjs/server', () => ({ auth: () => mockAuth() }));
jest.mock('@lodgeflow/database', () => {
  const { ReservationRuleError } = jest.requireActual<
    typeof import('@lodgeflow/database')
  >('@lodgeflow/database');
  return {
    ReservationRuleError,
    connectDB: () => mockConnect(),
    createReservationCheckout: (
      ...args: Parameters<typeof createReservationCheckout>
    ) => mockCheckout(...args),
  };
});
jest.mock('@/lib/stripe', () => ({ getStripe: () => mockGetStripe() }));
jest.mock('@lodgeflow/database/logger', () => ({
  logger: { error: (...args: unknown[]) => mockLoggerError(...args) },
}));

import { ReservationRuleError } from '@lodgeflow/database';
import { POST as diningCheckout } from '@/app/api/dining-reservations/[id]/checkout/route';
import { POST as experienceCheckout } from '@/app/api/experience-bookings/[id]/checkout/route';

const originalOrigin = process.env.NEXT_PUBLIC_APP_URL;
const reservationId = '507f1f77bcf86cd7994390ab';
const gateway: Parameters<typeof createReservationCheckout>[0]['stripe'] = {
  checkout: {
    sessions: {
      create: async () => {
        throw new Error('Unexpected provider call');
      },
      retrieve: async () => {
        throw new Error('Unexpected provider call');
      },
    },
  },
  refunds: {
    create: async () => {
      throw new Error('Unexpected provider call');
    },
    retrieve: async () => {
      throw new Error('Unexpected provider call');
    },
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue({ userId: 'customer' });
  mockConnect.mockResolvedValue(undefined);
  // The real domain operation invokes this only when it needs a new session.
  // Real-Mongo coverage verifies its owner/open-session/quote ordering.
  mockCheckout.mockImplementation(async ({ getReturnUrl }) => {
    getReturnUrl();
    return 'https://checkout.stripe.invalid/session';
  });
  mockGetStripe.mockReturnValue(gateway);
  process.env.NEXT_PUBLIC_APP_URL = 'lodgeflow.app/';
});

afterEach(() => {
  if (originalOrigin === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = originalOrigin;
});

for (const [kind, handler, pathname] of [
  ['dining', diningCheckout, 'dining'],
  ['experience', experienceCheckout, 'experiences'],
] as const) {
  const run = () =>
    handler(
      new NextRequest(`http://localhost:3002/api/${kind}/checkout`, {
        method: 'POST',
      }),
      { params: Promise.resolve({ id: reservationId }) }
    );

  describe(`${kind} checkout origin boundary`, () => {
    test.each([
      ['lodgeflow.app/', 'https://lodgeflow.app'],
      ['localhost:3002', 'http://localhost:3002'],
      ['https://preview.example.com/', 'https://preview.example.com'],
      [undefined, 'http://localhost:3002'],
    ])(
      'preserves configured and fallback origins: %s',
      async (configured, expected) => {
        if (configured === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
        else process.env.NEXT_PUBLIC_APP_URL = configured;
        const response = await run();
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
          success: true,
          data: { url: 'https://checkout.stripe.invalid/session' },
        });
        expect(mockCheckout).toHaveBeenCalledWith({
          kind,
          id: reservationId,
          customer: 'customer',
          stripe: gateway,
          getReturnUrl: expect.any(Function),
        });
        expect(mockCheckout.mock.calls[0][0].getReturnUrl()).toBe(
          `${expected}/${pathname}/confirmation/${reservationId}`
        );
      }
    );

    test.each([
      '',
      'https://example.com/path',
      'https://user:private-token@example.com',
      'https://admin.lodgeflow.app',
    ])(
      'reports safe failure when a new session needs an unusable origin: %s',
      async configured => {
        process.env.NEXT_PUBLIC_APP_URL = configured;
        const response = await run();
        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({
          error: 'Unable to start checkout',
        });
        expect(mockCheckout).toHaveBeenCalledTimes(1);
        expect(mockLoggerError).toHaveBeenCalled();
      }
    );

    test('rejects absent authentication before reading invalid configuration or accessing storage', async () => {
      mockAuth.mockResolvedValue({ userId: null });
      process.env.NEXT_PUBLIC_APP_URL = '';
      const response = await run();
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        error: 'Authentication required',
      });
      expect(mockConnect).not.toHaveBeenCalled();
      expect(mockCheckout).not.toHaveBeenCalled();
      expect(mockGetStripe).not.toHaveBeenCalled();
    });

    test('preserves typed owner/missing resource denial', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://example.com/path';
      mockCheckout.mockRejectedValue(
        new ReservationRuleError('Reservation not found', 404)
      );
      const response = await run();
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'Reservation not found' });
    });

    test('lets the domain reuse an open session without resolving an invalid new-checkout origin', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://example.com/path';
      mockCheckout.mockResolvedValue(
        'https://checkout.stripe.invalid/existing'
      );
      const response = await run();
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        success: true,
        data: { url: 'https://checkout.stripe.invalid/existing' },
      });
    });

    test('logs unexpected failures and keeps provider details out of the response', async () => {
      const failure = new Error('provider private-token');
      mockCheckout.mockRejectedValue(failure);
      const response = await run();
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        error: 'Unable to start checkout',
      });
      expect(mockLoggerError).toHaveBeenCalledWith(
        'Error creating reservation checkout',
        failure
      );
    });
  });
}
