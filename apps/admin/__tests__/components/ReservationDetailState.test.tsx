import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ReservationDetail } from '@/components/ReservationDetail';
import type { DiningReservationDetail } from '@lodgeflow/database/reservation-json';
import type { PaymentSummary } from '@/components/ReservationPayments';

jest.mock('@/components/AuthGuard', () => ({ usePermission: () => true }));
jest.mock('@/components/ReservationPayments', () => ({
  ReservationPayments: ({ reload }: { reload: () => Promise<void> }) => (
    <button onClick={() => void reload().catch(() => {})}>
      Refresh payments
    </button>
  ),
}));
const fetchMock = jest.fn();
const originalFetch = global.fetch;
const payment: PaymentSummary = {
  totalCents: 1000,
  paidCents: 0,
  balanceCents: 1000,
  refundedCents: 0,
  refundableCents: 0,
  legacyPaid: false,
};
function payload(customerName: string) {
  const reservation: DiningReservationDetail = {
    _id: customerName,
    customer: 'customer',
    dining: null,
    date: '2040-01-01T00:00:00Z',
    time: '18:00',
    numGuests: 2,
    status: 'confirmed',
    totalPrice: 10,
    isPaid: false,
  };
  return {
    reservation,
    customerName,
    allowedStatuses: ['seated', 'cancelled'],
    currency: 'USD',
    payment,
  };
}
function response(data: ReturnType<typeof payload>) {
  return { ok: true, json: async () => ({ data }) };
}
beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
});
afterEach(() => {
  global.fetch = originalFetch;
});

test('preserves status request and refreshes only after success; failed save keeps draft', async () => {
  fetchMock
    .mockResolvedValueOnce(response(payload('Ada')))
    .mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Status changed' }),
    })
    .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    .mockResolvedValueOnce(response(payload('Ada')));
  render(<ReservationDetail kind='dining' id='one' />);
  await screen.findByText('Ada');
  fireEvent.change(screen.getByLabelText('Change status'), {
    target: { value: 'seated' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save status' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Status changed');
  expect(screen.getByLabelText('Change status')).toHaveValue('seated');
  expect(fetchMock).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('button', { name: 'Save status' }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
  expect(fetchMock.mock.calls[1]).toEqual([
    '/api/dining-reservations/one',
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'seated', expectedStatus: 'confirmed' }),
    },
  ]);
  await waitFor(() =>
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  );
  expect(screen.getByLabelText('Change status')).toHaveValue('');
});

test('retries a failed initial load and clears the old error', async () => {
  fetchMock
    .mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValueOnce(response(payload('Retry Guest')));
  render(<ReservationDetail kind='dining' id='one' />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Offline');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByText('Retry Guest');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('a resource change hides old data and ignores the previous late load', async () => {
  let finish: (value: ReturnType<typeof response>) => void = () => {
    throw new Error('not started');
  };
  fetchMock
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        })
    )
    .mockResolvedValueOnce(response(payload('Current Guest')));
  const { rerender } = render(<ReservationDetail kind='dining' id='one' />);
  rerender(<ReservationDetail kind='experience' id='two' />);
  await screen.findByText('Current Guest');
  await act(async () => {
    finish(response(payload('Old Guest')));
  });
  expect(screen.queryByText('Old Guest')).not.toBeInTheDocument();
  expect(screen.getByText('Current Guest')).toBeInTheDocument();
});

test('payment refresh preserves the independently edited status draft', async () => {
  fetchMock.mockResolvedValue(response(payload('Ada')));
  render(<ReservationDetail kind='dining' id='one' />);
  await screen.findByText('Ada');
  fireEvent.change(screen.getByLabelText('Change status'), {
    target: { value: 'seated' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Refresh payments' }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  await act(async () => {});
  expect(screen.getByLabelText('Change status')).toHaveValue('seated');
});

test.each([
  {
    name: 'refundable payment',
    update: (data: ReturnType<typeof payload>) => {
      data.payment = { ...payment, refundableCents: 100 };
    },
  },
  {
    name: 'pending checkout',
    update: (data: ReturnType<typeof payload>) => {
      data.reservation.checkout = {
        token: 'checkout',
        amountCents: 1000,
        currency: 'usd',
        createdAt: '2040-01-01T00:00:00Z',
        pending: true,
      };
    },
  },
  {
    name: 'pending refund',
    update: (data: ReturnType<typeof payload>) => {
      data.reservation.stripeRefund = {
        token: 'refund',
        amountCents: 100,
        reference: '',
        actor: 'staff',
        createdAt: '2040-01-01T00:00:00Z',
        status: 'pending',
      };
    },
  },
  {
    name: 'removed allowed status',
    update: (data: ReturnType<typeof payload>) => {
      data.allowedStatuses = ['seated'];
    },
  },
])(
  'refresh reconciles cancellation draft after $name without submitting it',
  async ({ update }) => {
    const updated = payload('Ada');
    update(updated);
    fetchMock
      .mockResolvedValueOnce(response(payload('Ada')))
      .mockResolvedValueOnce(response(updated));
    render(<ReservationDetail kind='dining' id='one' />);
    await screen.findByText('Ada');
    fireEvent.change(screen.getByLabelText('Change status'), {
      target: { value: 'cancelled' },
    });
    expect(screen.getByRole('button', { name: 'Save status' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh payments' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save status' })).toBeDisabled()
    );
    expect(screen.getByLabelText('Change status')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Save status' }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  }
);
