/** @jest-environment node */

import {
  checkoutApiErrors,
  checkoutUrl,
  invalidCheckoutResponses,
  localCheckoutUrl,
} from '@/__tests__/shared/checkout-failure-fixtures';
import { openReservationCheckout } from '@/lib/open-reservation-checkout';

const assign = jest.fn();
const fetchMock = jest.mocked(fetch);
const id = 'reservation';

beforeAll(() => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { assign } },
  });
});
afterAll(() => {
  Reflect.deleteProperty(globalThis, 'window');
});
beforeEach(() => jest.resetAllMocks());

describe.each([
  { kind: 'dining', route: '/api/dining-reservations/reservation/checkout' },
  {
    kind: 'experience',
    route: '/api/experience-bookings/reservation/checkout',
  },
] as const)('$kind checkout', ({ kind, route }) => {
  test.each(invalidCheckoutResponses)(
    'rejects $name without navigating',
    async ({ status, body, headers }) => {
      fetchMock.mockResolvedValue(new Response(body, { status, headers }));
      await expect(openReservationCheckout({ kind, id })).rejects.toMatchObject(
        {
          message: 'Unable to start checkout',
        }
      );
      expect(assign).not.toHaveBeenCalled();
    }
  );

  test.each(checkoutApiErrors)(
    'preserves a structured API error ($status) without navigating',
    async ({ status, body, message }) => {
      fetchMock.mockResolvedValue(new Response(body, { status }));
      await expect(openReservationCheckout({ kind, id })).rejects.toMatchObject(
        {
          message,
        }
      );
      expect(assign).not.toHaveBeenCalled();
    }
  );

  test.each([checkoutUrl, localCheckoutUrl])(
    'retries the same POST and navigates once to %s',
    async url => {
      fetchMock
        .mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
        .mockResolvedValueOnce(
          Response.json({
            success: true,
            data: { url, expiresAt: '2030-01-01' },
          })
        );

      await expect(openReservationCheckout({ kind, id })).rejects.toMatchObject(
        {
          message: 'Unable to start checkout',
        }
      );
      expect(assign).not.toHaveBeenCalled();
      await openReservationCheckout({ kind, id });
      expect(fetchMock.mock.calls).toEqual([
        [route, { method: 'POST' }],
        [route, { method: 'POST' }],
      ]);
      expect(assign.mock.calls).toEqual([[url]]);
    }
  );
});
