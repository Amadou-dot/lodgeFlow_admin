import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ReservationDetail } from '@/components/ReservationDetail';
import { reservationReceiptSchema } from '@/lib/validations/reservation-payment';
import { ReservationPayments } from '@/components/ReservationPayments';
import { useReservationPaymentAttempt } from '@/hooks/useReservationPaymentAttempt';
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
let mockSessionId = 'staff-session';
jest.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ userId: 'staff', sessionId: mockSessionId }),
}));
jest.mock('@/components/AuthGuard', () => ({
  usePermission: (permission: string) =>
    permission === 'refunds:issue' ? mockCanRefund : mockCanManage,
}));
const fetchMock = jest.fn();
const originalFetch = global.fetch;

type FormProps = Omit<ComponentProps<typeof ReservationPayments>, 'submission'>;
function PaymentForm(props: FormProps) {
  const submission = useReservationPaymentAttempt();
  return <ReservationPayments {...props} submission={submission} />;
}

function show(overrides: Partial<FormProps> = {}) {
  const reload = jest.fn().mockResolvedValue(stripeDetail);
  render(
    <PaymentForm
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
  mockSessionId = 'staff-session';
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
const unpaidDetail = {
  ...stripeDetail,
  reservation: { ...stripeDetail.reservation, receipts: [] },
  payment: {
    ...stripeDetail.payment,
    paidCents: 0,
    refundableCents: 0,
    balanceCents: 1000,
  },
};

test('a rejected replay allows the amount to be corrected under the original receipt ID', async () => {
  const saved = {
    ...write,
    receipts: [{ ...write.receipts[0], amountCents: 1000 }],
  };
  fetchMock
    .mockResolvedValueOnce(ok(unpaidDetail))
    .mockRejectedValueOnce(new Error('Lost payment response'))
    .mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: 'Payment exceeds the outstanding balance',
      }),
    })
    .mockResolvedValueOnce(ok(unpaidDetail))
    .mockResolvedValueOnce(ok(saved))
    .mockResolvedValueOnce(
      ok({
        ...unpaidDetail,
        reservation: { ...saved, dining: null, isPaid: true },
        payment: { ...unpaidDetail.payment, paidCents: 1000, balanceCents: 0 },
      })
    );
  render(<ReservationDetail kind='dining' id={write._id} />);
  await screen.findByLabelText('Amount (EUR)');
  enterAmount('11');
  const replay = await screen.findByRole('button', {
    name: 'Retry original transaction',
  });
  fireEvent.change(screen.getByLabelText('Amount (EUR)'), {
    target: { value: '10' },
  });
  fireEvent.click(replay);
  const pay = screen.getByRole('button', { name: /Saving…|Record payment/ });
  await waitFor(() => expect(pay).toBeEnabled());
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Payment exceeds the outstanding balance'
  );
  fireEvent.click(pay);
  await screen.findByText(/Payment · €10.00/);
  expect(fetchMock.mock.calls[2]).toEqual(fetchMock.mock.calls[1]);
  expect(JSON.parse(fetchMock.mock.calls[4][1].body)).toMatchObject({
    id: firstId,
    amountCents: 1000,
  });
  expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
});

test('a denied refresh hides the detail and preserves the in-flight partial receipt on return', async () => {
  let loseResponse!: (error: Error) => void;
  const inFlight = new Promise((_resolve, reject) => {
    loseResponse = reject;
  });
  fetchMock
    .mockResolvedValueOnce(ok(unpaidDetail))
    .mockReturnValueOnce(inFlight)
    .mockResolvedValueOnce(ok({ ...write, status: 'completed' }))
    .mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ success: false, error: 'Detail unavailable' }),
    })
    .mockResolvedValueOnce(ok(unpaidDetail))
    .mockResolvedValueOnce(ok(write))
    .mockResolvedValueOnce(ok(unpaidDetail));
  render(<ReservationDetail kind='dining' id={write._id} />);
  await screen.findByLabelText('Amount (EUR)');
  enterAmount('0.29');
  fireEvent.change(screen.getByLabelText('Change status'), {
    target: { value: 'completed' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save status' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Detail unavailable'
  );
  expect(screen.queryByText('Payments and refunds')).not.toBeInTheDocument();
  expect(
    screen.queryByText('Guest', { selector: 'dd' })
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  const amount = await screen.findByLabelText('Amount (EUR)');
  expect(amount).toHaveValue('');
  fireEvent.change(amount, { target: { value: '0.29' } });
  fireEvent.submit(
    screen.getByRole('button', { name: /Record payment|Saving…/ })
  );
  expect(fetchMock).toHaveBeenCalledTimes(5);
  await act(async () => loseResponse(new Error('Connection lost')));
  fireEvent.click(
    await screen.findByRole('button', { name: 'Retry original transaction' })
  );
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(7));
  expect(fetchMock.mock.calls[5]).toEqual(fetchMock.mock.calls[1]);
  expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
});

test('a delayed original receipt wins over a correction without reporting the correction as saved', async () => {
  const conflict = {
    ok: false,
    status: 409,
    json: async () => ({ success: false, error: 'Reservation changed' }),
  };
  const reload = show();
  reload.mockResolvedValueOnce(unpaidDetail).mockResolvedValueOnce({
    ...unpaidDetail,
    reservation: { ...write, dining: null },
  });
  fetchMock
    .mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValueOnce(conflict)
    .mockResolvedValueOnce(conflict);
  enterAmount('0.29');
  fireEvent.click(
    await screen.findByRole('button', { name: 'Retry original transaction' })
  );
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Record payment' })).toBeEnabled()
  );
  enterAmount('0.28');
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent(
      'already records a cash payment of €0.29'
    )
  );
  expect(screen.getByLabelText('Amount (EUR)')).toHaveValue('0.28');
  expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
});

test('checking an existing Stripe refund keeps the ID and draft of a rejected manual receipt', async () => {
  const partial = {
    ...stripeDetail,
    reservation: { ...stripeDetail.reservation, totalPrice: 20 },
    payment: { ...stripeDetail.payment, totalCents: 2000, balanceCents: 1000 },
  };
  const pending = {
    ...partial,
    reservation: {
      ...partial.reservation,
      stripeRefund: {
        token: secondId,
        amountCents: 29,
        reference: 'Original refund',
        status: 'pending',
      },
    },
  };
  const receipts = [
    stripeReceipt,
    {
      ...stripeReceipt,
      type: 'refund',
      id: secondId,
      amountCents: 29,
      reference: 'Original refund',
    },
  ];
  const refunded = {
    ...partial,
    reservation: { ...partial.reservation, receipts },
    payment: { ...partial.payment, refundedCents: 29, refundableCents: 971 },
  };
  const recorded = [...receipts, write.receipts[0]];
  fetchMock
    .mockResolvedValueOnce(ok(partial))
    .mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({
        success: false,
        error: 'An online transaction is pending',
      }),
    })
    .mockResolvedValueOnce(ok(pending))
    .mockResolvedValueOnce(ok({ status: 'succeeded' }))
    .mockResolvedValueOnce(ok(refunded))
    .mockResolvedValueOnce(ok({ ...write, totalPrice: 20, receipts: recorded }))
    .mockResolvedValueOnce(
      ok({
        ...refunded,
        reservation: { ...refunded.reservation, receipts: recorded },
        payment: {
          ...refunded.payment,
          paidCents: 1029,
          balanceCents: 971,
          refundableCents: 1000,
        },
      })
    );
  render(<ReservationDetail kind='dining' id={write._id} />);
  await screen.findByLabelText('Amount (EUR)');
  enterAmount('0.30');
  const replay = await screen.findByRole('button', {
    name: 'Retry original transaction',
  });
  fireEvent.change(screen.getByLabelText('Amount (EUR)'), {
    target: { value: '0.29' },
  });
  fireEvent.click(replay);
  const check = await screen.findByRole('button', {
    name: 'Check or retry refund',
  });
  await waitFor(() => expect(check).toBeEnabled());
  fireEvent.click(check);
  expect(await screen.findByLabelText('Amount (EUR)')).toHaveValue('0.29');
  fireEvent.click(screen.getByRole('button', { name: 'Record payment' }));
  await waitFor(() =>
    expect(screen.getByLabelText('Amount (EUR)')).toHaveValue('')
  );
  expect(JSON.parse(fetchMock.mock.calls[4][1].body)).toMatchObject({
    id: secondId,
    method: 'stripe',
  });
  expect(JSON.parse(fetchMock.mock.calls[6][1].body)).toMatchObject({
    id: firstId,
    method: 'cash',
    amountCents: 29,
  });
  expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
});

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
      screen.getByRole('button', { name: 'Retry original transaction' })
    ).toBeEnabled();
  }
);

test.each(['reservation', 'session'])(
  'changing %s clears the previous mounted uncertain attempt and edited draft',
  async change => {
    const nextId =
      change === 'reservation' ? '507f1f77bcf86cd799439099' : write._id;
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
    fireEvent.change(
      screen.getByLabelText('Receipt reference / refund reason'),
      {
        target: { value: 'Held note' },
      }
    );
    if (change === 'session') mockSessionId = 'another-session';
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
  }
);

test('explicit pending retry reaches the provider with the saved token after a competing equal-body refund', async () => {
  const pending = {
    ...stripeDetail,
    reservation: {
      ...stripeDetail.reservation,
      stripeRefund: {
        token: secondId,
        amountCents: 29,
        reference: 'Guest request',
        status: 'pending',
      },
    },
  };
  const provider = jest.fn().mockResolvedValue(ok({ status: 'pending' }));
  fetchMock
    .mockResolvedValueOnce(ok(stripeDetail))
    .mockResolvedValueOnce(stripeDenial)
    .mockResolvedValueOnce(ok(pending))
    .mockImplementationOnce(async (_url: string, options: RequestInit) => {
      const input = reservationReceiptSchema.parse(
        JSON.parse(String(options.body))
      );
      return input.id === secondId ? provider(input) : stripeDenial;
    })
    .mockResolvedValueOnce(ok(pending));
  await submitStripeRefund();
  fireEvent.click(
    await screen.findByRole('button', { name: 'Check or retry refund' })
  );
  await waitFor(() => expect(provider).toHaveBeenCalledTimes(1));
  const original = reservationReceiptSchema.parse(
    JSON.parse(fetchMock.mock.calls[1][1].body)
  );
  expect(original.id).toBe(firstId);
  expect(provider).toHaveBeenCalledWith({ ...original, id: secondId });
  expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
  await waitFor(() =>
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  );
});

test('invalid manual reference stays editable without transmission and correction records one receipt', async () => {
  const stored = new Map<string, (typeof write.receipts)[number]>();
  fetchMock.mockImplementation(async (_url: string, options: RequestInit) => {
    const parsed = reservationReceiptSchema.safeParse(
      JSON.parse(String(options.body))
    );
    if (!parsed.success) throw new Error('Response lost');
    const row = { ...write.receipts[0], ...parsed.data };
    stored.set(row.id, row);
    return ok({ ...write, receipts: Array.from(stored.values()) });
  });
  const reload = show();
  fireEvent.change(screen.getByLabelText('Method'), {
    target: { value: 'card' },
  });
  const note = screen.getByLabelText('Receipt reference / refund reason');
  fireEvent.change(note, { target: { value: '   ' } });
  enterAmount('0.29');
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Provide a receipt reference or refund reason'
  );
  expect(fetchMock).not.toHaveBeenCalled();
  expect(stored.size).toBe(0);
  expect(
    screen.queryByRole('button', { name: 'Retry original transaction' })
  ).not.toBeInTheDocument();
  fireEvent.change(note, { target: { value: '  Terminal 42  ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Record payment' }));
  await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).reference).toBe(
    '  Terminal 42  '
  );
  expect(Array.from(stored.values())).toEqual([
    expect.objectContaining({
      method: 'card',
      type: 'payment',
      amountCents: 29,
      reference: 'Terminal 42',
    }),
  ]);
});
