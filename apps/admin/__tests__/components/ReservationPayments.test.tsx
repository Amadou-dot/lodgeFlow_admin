import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReservationPayments } from '@/components/ReservationPayments';
import type { ComponentProps } from 'react';

const write = {
  _id: '507f1f77bcf86cd799439011',
  id: '507f1f77bcf86cd799439011',
  dining: '507f1f77bcf86cd799439012',
  customer: 'guest',
  date: '2040-01-01T00:00:00.000Z',
  time: '19:00',
  numGuests: 2,
  totalPrice: 10,
  status: 'confirmed',
  isPaid: false,
  receipts: [
    {
      id: 'saved',
      type: 'payment',
      amountCents: 29,
      method: 'cash',
      actor: 'staff',
      reference: '',
      recordedAt: '2040-01-01T00:00:00.000Z',
    },
  ],
};
function ok(data: unknown) {
  return { ok: true, json: async () => ({ success: true, data }) };
}

let mockCanManage = true;
let mockCanRefund = true;
jest.mock('@/components/AuthGuard', () => ({
  usePermission: (permission: string) =>
    permission === 'refunds:issue' ? mockCanRefund : mockCanManage,
}));
const fetchMock = jest.fn();
const originalFetch = global.fetch;
const firstId = '00000000-0000-4000-8000-000000000001';
const secondId = '00000000-0000-4000-8000-000000000002';

function show(
  overrides: Partial<ComponentProps<typeof ReservationPayments>> = {}
) {
  const reload = jest.fn().mockResolvedValue(undefined);
  render(
    <ReservationPayments
      kind='dining'
      endpoint='/api/dining-reservations/reservation'
      currency='EUR'
      status='confirmed'
      payment={{
        totalCents: 123456,
        paidCents: 10001,
        balanceCents: 113455,
        refundedCents: 29,
        refundableCents: 9972,
        legacyPaid: false,
      }}
      receipts={[
        {
          id: 'receipt',
          type: 'payment',
          method: 'cash',
          amountCents: 29,
          recordedAt: '2040-01-01T00:00:00.000Z',
          reference: '',
          actor: 'staff',
        },
      ]}
      reload={reload}
      {...overrides}
    />
  );
  return reload;
}

function enterAmount(value: string) {
  fireEvent.change(screen.getByLabelText('Amount (EUR)'), {
    target: { value },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Record payment' }));
}

beforeEach(() => {
  mockCanManage = true;
  mockCanRefund = true;
  fetchMock.mockReset().mockResolvedValue(ok(write));
  global.fetch = fetchMock;
  jest
    .spyOn(crypto, 'randomUUID')
    .mockReturnValueOnce(firstId)
    .mockReturnValue(secondId);
});
afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

test('displays cents in the selected currency and posts exact integer cents', async () => {
  const reload = show();
  expect(screen.getByText('€1,234.56')).toBeInTheDocument();
  expect(screen.getByText(/Payment · €0.29 · cash/)).toBeInTheDocument();
  enterAmount('0.29');
  await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/dining-reservations/reservation/payments',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'payment',
        method: 'cash',
        amountCents: 29,
        reference: '',
        id: firstId,
      }),
    }
  );
  expect(screen.getByLabelText('Amount (EUR)')).toHaveValue('');
});

test('reuses the transaction identifier after failure and replaces it when the amount changes', async () => {
  fetchMock.mockResolvedValue({
    ok: false,
    json: async () => ({ error: 'Try again' }),
  });
  show();
  enterAmount('0.29');
  await screen.findByRole('alert');
  enterAmount('0.29');
  await screen.findByRole('alert');
  enterAmount('0.30');
  await screen.findByRole('alert');
  const bodies = fetchMock.mock.calls.map(([, input]: [string, RequestInit]) =>
    JSON.parse(String(input.body))
  );
  expect(bodies).toEqual([
    {
      type: 'payment',
      method: 'cash',
      amountCents: 29,
      reference: '',
      id: firstId,
    },
    {
      type: 'payment',
      method: 'cash',
      amountCents: 29,
      reference: '',
      id: firstId,
    },
    {
      type: 'payment',
      method: 'cash',
      amountCents: 30,
      reference: '',
      id: secondId,
    },
  ]);
});

test.each(['0', '-1', '1.005', '1e2', '9007199254740991', '9'.repeat(400)])(
  'rejects invalid or unsafe money input %s before requesting a transaction',
  async value => {
    show();
    enterAmount(value);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter a positive amount with at most two decimal places'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  }
);

test.each([null, 'pending'])(
  'pending Stripe refund retries preserve the server token and original amount for status %s',
  async status => {
    fetchMock
      .mockResolvedValueOnce(ok(write))
      .mockResolvedValueOnce(ok({ status }));
    const reload = show({
      stripeRefund: {
        status: 'pending',
        token: firstId,
        amountCents: 29,
        reference: 'Duplicate charge',
        actor: 'staff',
        createdAt: '2040-01-01T00:00:00.000Z',
      },
    });
    expect(screen.queryByLabelText('Amount (EUR)')).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Check or retry refund' })
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to record transaction'
    );
    expect(reload).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Check or retry refund' })
    );
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          type: 'refund',
          method: 'stripe',
          amountCents: 29,
          reference: 'Duplicate charge',
          id: firstId,
        }),
      })
    );
  }
);

test('permissions keep payment entry and pending-refund retry unavailable', () => {
  mockCanManage = false;
  mockCanRefund = false;
  show({
    stripeRefund: {
      status: 'pending',
      token: firstId,
      amountCents: 29,
      actor: 'staff',
      reference: '',
      createdAt: '2040-01-01T00:00:00.000Z',
    },
  });
  expect(screen.queryByLabelText('Amount (EUR)')).not.toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

test.each([
  ['wrong branch', ok({ status: 'succeeded' })],
  ['missing data', { ok: true, json: async () => ({ success: true }) }],
  [
    'false success flag',
    { ok: true, json: async () => ({ success: false, data: write }) },
  ],
  [
    'invalid JSON',
    {
      ok: true,
      json: async () => {
        throw new SyntaxError('invalid');
      },
    },
  ],
])(
  'keeps amount, reference and request identifier after %s',
  async (_, invalid) => {
    fetchMock.mockResolvedValueOnce(invalid).mockResolvedValueOnce(ok(write));
    const reload = show();
    fireEvent.change(
      screen.getByLabelText('Receipt reference / refund reason'),
      { target: { value: 'Cash desk' } }
    );
    enterAmount('0.29');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to record transaction'
    );
    expect(reload).not.toHaveBeenCalled();
    expect(
      screen.getByLabelText('Receipt reference / refund reason')
    ).toHaveValue('Cash desk');
    expect(screen.getByLabelText('Amount (EUR)')).toHaveValue('0.29');
    enterAmount('0.29');
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[1]).toEqual(fetchMock.mock.calls[0]);
    expect(screen.getByLabelText('Amount (EUR)')).toHaveValue('');
    expect(
      screen.getByLabelText('Receipt reference / refund reason')
    ).toHaveValue('');
  }
);
test.each([
  ['A1!', '1234.56 A1!'],
  [null, '$1,234.56'],
])('uses the stored currency %s to display cents', (currency, expected) => {
  show({ currency });
  expect(screen.getByText(String(expected))).toBeInTheDocument();
});
test('displays the exact value of a safe receipt that cannot round trip through major units', () => {
  show({
    receipts: [
      {
        id: 'large',
        type: 'payment',
        method: 'cash',
        amountCents: Number.MAX_SAFE_INTEGER,
        recordedAt: '2040-01-01T00:00:00.000Z',
        reference: '',
        actor: 'staff',
      },
    ],
  });
  expect(
    screen.getByText(/9007199254740991 cents \(EUR\)/)
  ).toBeInTheDocument();
});

test('incomplete stored pending refund keeps normal entry disabled and cannot allocate a replacement token', () => {
  show({ stripeRefund: { status: 'pending', amountCents: 29 } });
  expect(screen.getByText('Online refund is pending.')).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Amount (EUR)')).not.toBeInTheDocument();
  expect(crypto.randomUUID).not.toHaveBeenCalled();
});
