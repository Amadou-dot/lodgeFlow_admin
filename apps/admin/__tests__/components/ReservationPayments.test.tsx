import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReservationDetail } from '@/components/ReservationDetail';
import { reservationReceiptSchema } from '@/lib/validations/reservation-payment';
import { ReservationPayments } from '@/components/ReservationPayments';
import type { ComponentProps } from 'react';

const firstId = '00000000-0000-4000-8000-000000000001';
const secondId = '00000000-0000-4000-8000-000000000002';
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
      id: firstId,
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

function show(
  overrides: Partial<ComponentProps<typeof ReservationPayments>> = {}
) {
  const reload = jest.fn().mockResolvedValue(stripeDetail);
  render(
    <ReservationPayments
      kind='dining'
      reservationId={write._id}
      endpoint={`/api/dining-reservations/${write._id}`}
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
    `/api/dining-reservations/${write._id}/payments`,
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
    status: 400,
    json: async () => ({ success: false, error: 'Try again' }),
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
      screen.getByRole('button', { name: 'Retry original transaction' })
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
  [
    'wrong reservation',
    ok({
      ...write,
      _id: '507f1f77bcf86cd799439099',
      id: '507f1f77bcf86cd799439099',
      receipts: [{ ...write.receipts[0], reference: 'Cash desk' }],
    }),
  ],
  ...Object.entries({
    id: secondId,
    type: 'refund',
    method: 'card',
    amountCents: 30,
    reference: 'Other desk',
  }).map(([field, value]): [string, ReturnType<typeof ok>] => [
    'wrong receipt ' + field,
    ok({
      ...write,
      receipts: [
        { ...write.receipts[0], reference: 'Cash desk', [field]: value },
      ],
    }),
  ]),
  ['missing receipt', ok({ ...write, receipts: [] })],
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
    fetchMock.mockResolvedValueOnce(invalid).mockResolvedValueOnce(
      ok({
        ...write,
        receipts: [{ ...write.receipts[0], reference: 'Cash desk' }],
      })
    );
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
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry original transaction' })
    );
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

test.each(['Cash desk ', 'Corrected desk note'])(
  'holds reference edit %j after the server commits but returns malformed data',
  async edited => {
    const persisted = new Map<string, (typeof write.receipts)[number]>();
    fetchMock.mockImplementation(async (_url: string, options: RequestInit) => {
      const input = reservationReceiptSchema.parse(
        JSON.parse(String(options.body))
      );
      const row = {
        ...write.receipts[0],
        ...input,
        reference: input.reference,
      };
      if (!persisted.has(row.id)) persisted.set(row.id, row);
      else expect(persisted.get(row.id)).toEqual(row);
      if (fetchMock.mock.calls.length === 1) return ok({});
      return ok({ ...write, receipts: Array.from(persisted.values()) });
    });
    const reload = show();
    const note = screen.getByLabelText('Receipt reference / refund reason');
    fireEvent.change(note, { target: { value: 'Cash desk' } });
    enterAmount('0.29');
    await screen.findByRole('alert');
    expect(persisted.size).toBe(1);
    expect(reload).not.toHaveBeenCalled();
    fireEvent.change(note, { target: { value: edited } });
    const pay = screen.getByRole('button', { name: 'Record payment' });
    fireEvent.click(pay);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry original transaction' })
    );
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[1]).toEqual(fetchMock.mock.calls[0]);
    expect(persisted.size).toBe(1);
    expect(note).toHaveValue(edited);
    expect(screen.getByLabelText('Amount (EUR)')).toHaveValue('0.29');
    expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
    fireEvent.click(pay);
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(2));
    expect(Array.from(persisted.keys())).toEqual([firstId, secondId]);
    expect(note).toHaveValue('');
  }
);

test.each([
  'lost response',
  'server error',
  'invalid error envelope',
  'failed refresh',
  'superseded refresh',
])(
  'keeps the original attempt after %s and another inconclusive replay',
  async failure => {
    const reload = show();
    if (failure === 'lost response')
      fetchMock.mockRejectedValueOnce(new Error('Offline'));
    if (failure === 'server error')
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ success: false, error: 'Server error' }),
      });
    if (failure === 'invalid error envelope')
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ success: true, error: 'Conflicting response' }),
      });
    if (failure === 'failed refresh')
      reload.mockRejectedValueOnce(new Error('Offline'));
    if (failure === 'superseded refresh')
      reload.mockResolvedValueOnce(undefined);
    enterAmount('0.29');
    const replay = await screen.findByRole('button', {
      name: 'Retry original transaction',
    });
    fireEvent.change(screen.getByLabelText('Amount (EUR)'), {
      target: { value: '0.30' },
    });
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ success: false, error: 'Unauthorized' }),
    });
    fireEvent.click(replay);
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Unauthorized')
    );
    expect(
      screen.getByRole('button', { name: 'Record payment' })
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry original transaction' })
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Record payment' })
      ).toBeEnabled()
    );
    expect(fetchMock.mock.calls[1]).toEqual(fetchMock.mock.calls[0]);
    expect(fetchMock.mock.calls[2]).toEqual(fetchMock.mock.calls[0]);
    expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Amount (EUR)')).toHaveValue('0.30');
  }
);

const stripeReceipt = {
  ...write.receipts[0],
  id: 'provider-payment',
  method: 'stripe',
  amountCents: 1000,
};
const stripeDetail = {
  customerName: 'Guest',
  currency: 'EUR',
  allowedStatuses: ['completed'],
  reservation: { ...write, dining: null, receipts: [stripeReceipt] },
  payment: {
    totalCents: 1000,
    paidCents: 1000,
    refundableCents: 1000,
    refundedCents: 0,
    balanceCents: 0,
    legacyPaid: false,
  },
};
const stripeDenial = {
  ok: false,
  status: 409,
  json: async () => ({ success: false, error: 'Refund conflict' }),
};
async function submitStripeRefund() {
  const view = render(<ReservationDetail kind='dining' id={write._id} />);
  fireEvent.change(await screen.findByLabelText('Transaction'), {
    target: { value: 'refund' },
  });
  fireEvent.change(screen.getByLabelText('Method'), {
    target: { value: 'stripe' },
  });
  fireEvent.change(screen.getByLabelText('Amount (EUR)'), {
    target: { value: '0.29' },
  });
  fireEvent.change(screen.getByLabelText('Receipt reference / refund reason'), {
    target: { value: 'Guest request' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Issue Stripe refund' }));
  return view;
}

test('a current detail after an ordinary Stripe rejection permits a corrected refund', async () => {
  fetchMock
    .mockResolvedValueOnce(ok(stripeDetail))
    .mockResolvedValueOnce({ ...stripeDenial, status: 400 })
    .mockResolvedValueOnce(ok(stripeDetail))
    .mockResolvedValueOnce(ok({ status: 'pending' }))
    .mockResolvedValueOnce(ok(stripeDetail));
  await submitStripeRefund();
  expect(await screen.findByRole('alert')).toHaveTextContent('Refund conflict');
  expect(fetchMock).toHaveBeenCalledTimes(3);
  fireEvent.change(screen.getByLabelText('Amount (EUR)'), {
    target: { value: '0.25' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Issue Stripe refund' }));
  await waitFor(() =>
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  );
  expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toMatchObject({
    id: secondId,
    amountCents: 25,
  });
});
test('a current detail with the original pending Stripe refund retains its attempt', async () => {
  const pending = {
    ...stripeDetail,
    reservation: {
      ...stripeDetail.reservation,
      stripeRefund: {
        token: firstId,
        amountCents: 29,
        reference: 'Guest request',
        status: 'pending',
      },
    },
  };
  fetchMock
    .mockResolvedValueOnce(ok(stripeDetail))
    .mockResolvedValueOnce(stripeDenial)
    .mockResolvedValueOnce(ok(pending))
    .mockResolvedValueOnce(ok({ status: null }))
    .mockResolvedValueOnce(ok(pending));
  await submitStripeRefund();
  expect(
    await screen.findByText('Online refund is pending.')
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Issue Stripe refund' })
  ).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('button', { name: 'Retry original transaction' })
  );
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));
  expect(fetchMock.mock.calls[3]).toEqual(fetchMock.mock.calls[1]);
  expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
});
test('a matching receipt in the current detail confirms a Stripe refund after a rule error', async () => {
  const settled = {
    ...stripeDetail,
    reservation: {
      ...stripeDetail.reservation,
      receipts: [
        stripeReceipt,
        {
          ...stripeReceipt,
          id: firstId,
          type: 'refund',
          amountCents: 29,
          reference: 'Guest request',
        },
      ],
    },
  };
  fetchMock
    .mockResolvedValueOnce(ok(stripeDetail))
    .mockResolvedValueOnce(stripeDenial)
    .mockResolvedValueOnce(ok(settled));
  await submitStripeRefund();
  expect(await screen.findByText(/Refund · €0.29/)).toBeInTheDocument();
  expect(screen.getByLabelText('Amount (EUR)')).toHaveValue('');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(3);
});
test('a failed detail refresh after a Stripe rule error holds the original UUID', async () => {
  fetchMock
    .mockResolvedValueOnce(ok(stripeDetail))
    .mockResolvedValueOnce(stripeDenial)
    .mockRejectedValueOnce(new Error('Offline'));
  await submitStripeRefund();
  await screen.findByRole('button', { name: 'Retry original transaction' });
  expect(
    screen.getByRole('button', { name: 'Issue Stripe refund' })
  ).toBeDisabled();
  expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
});
test('a superseded detail refresh after a Stripe rule error cannot release a changed draft', async () => {
  let finish: (res: ReturnType<typeof ok>) => void = () => {
    throw new Error('Recovery did not start');
  };
  const recovery = new Promise(resolve => {
    finish = resolve;
  });
  const completed = {
    ...stripeDetail,
    allowedStatuses: [],
    reservation: { ...stripeDetail.reservation, status: 'completed' },
  };
  fetchMock
    .mockResolvedValueOnce(ok(stripeDetail))
    .mockResolvedValueOnce(stripeDenial)
    .mockReturnValueOnce(recovery)
    .mockResolvedValueOnce(ok({ ...write, status: 'completed' }))
    .mockResolvedValueOnce(ok(completed));
  await submitStripeRefund();
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  fireEvent.change(screen.getByLabelText('Receipt reference / refund reason'), {
    target: { value: 'Changed note' },
  });
  fireEvent.change(screen.getByLabelText('Change status'), {
    target: { value: 'completed' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save status' }));
  await screen.findByText('completed', { selector: 'dd' });
  finish(ok(stripeDetail));
  await screen.findByRole('button', { name: 'Retry original transaction' });
  expect(
    screen.getByLabelText('Receipt reference / refund reason')
  ).toHaveValue('Changed note');
  expect(
    screen.getByRole('button', { name: 'Issue Stripe refund' })
  ).toBeDisabled();
  expect(fetchMock).toHaveBeenCalledTimes(5);
});

test.each([401, 403, 404])(
  'a current GET %s removes the previous detail throughout a pending access retry',
  async status => {
    let resolveRetry: (response: ReturnType<typeof ok>) => void = () => {
      throw new Error('Retry did not start');
    };
    const retry = new Promise(resolve => {
      resolveRetry = resolve;
    });
    fetchMock
      .mockResolvedValueOnce(ok(stripeDetail))
      .mockResolvedValueOnce(stripeDenial)
      .mockResolvedValueOnce({
        ok: false,
        status,
        json: async () => ({ success: false, error: 'Detail unavailable' }),
      })
      .mockReturnValueOnce(retry);
    await submitStripeRefund();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Detail unavailable'
    );
    expect(
      screen.queryByText('Guest', { selector: 'dd' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText('Receipt reference / refund reason')
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    expect(
      screen.queryByText('Guest', { selector: 'dd' })
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Amount (EUR)')).not.toBeInTheDocument();
    resolveRetry(ok({ ...stripeDetail, customerName: 'Current guest' }));
    await screen.findByText('Current guest');
    expect(screen.getByLabelText('Transaction')).toHaveValue('payment');
    expect(screen.getByLabelText('Amount (EUR)')).toHaveValue('');
    expect(
      screen.queryByRole('button', { name: 'Retry original transaction' })
    ).not.toBeInTheDocument();
  }
);

test('changing reservation clears the previous mounted uncertain attempt and edited draft', async () => {
  const nextId = '507f1f77bcf86cd799439099';
  const next = {
    ...stripeDetail,
    customerName: 'Next guest',
    reservation: { ...stripeDetail.reservation, _id: nextId, id: nextId },
  };
  fetchMock
    .mockResolvedValueOnce(ok(stripeDetail))
    .mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValueOnce(ok(next));
  const view = await submitStripeRefund();
  await screen.findByRole('button', { name: 'Retry original transaction' });
  fireEvent.change(screen.getByLabelText('Receipt reference / refund reason'), {
    target: { value: 'Held note' },
  });
  view.rerender(<ReservationDetail kind='dining' id={nextId} />);
  await screen.findByText('Next guest');
  expect(
    screen.queryByRole('button', { name: 'Retry original transaction' })
  ).not.toBeInTheDocument();
  expect(
    screen.getByLabelText('Receipt reference / refund reason')
  ).toHaveValue('');
  expect(screen.getByLabelText('Amount (EUR)')).toHaveValue('');
  expect(fetchMock).toHaveBeenCalledTimes(3);
});
