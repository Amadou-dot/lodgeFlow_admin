import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReservationPayments } from '@/components/ReservationPayments';
import type { ReservationPaymentJson } from '@lodgeflow/database/reservation-json';

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

function show(overrides: ReservationPaymentJson = {}) {
  const reload = jest.fn().mockResolvedValue(undefined);
  render(
    <ReservationPayments
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
  fetchMock
    .mockReset()
    .mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
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

test('pending Stripe refund retries preserve the server token and original amount', async () => {
  const reload = show({
    stripeRefund: {
      status: 'pending',
      token: 'refund-token',
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
  await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  expect(fetchMock).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      body: JSON.stringify({
        type: 'refund',
        method: 'stripe',
        amountCents: 29,
        reference: 'Duplicate charge',
        id: 'refund-token',
      }),
    })
  );
});

test('permissions keep payment entry and pending-refund retry unavailable', () => {
  mockCanManage = false;
  mockCanRefund = false;
  show({
    stripeRefund: {
      status: 'pending',
      token: 'refund-token',
      amountCents: 29,
      actor: 'staff',
      reference: '',
      createdAt: '2040-01-01T00:00:00.000Z',
    },
  });
  expect(screen.queryByLabelText('Amount (EUR)')).not.toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
