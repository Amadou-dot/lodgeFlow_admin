/** @jest-environment ./__tests__/setup/fetch-jsdom.cjs */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { addToast } from '@heroui/toast';
import { patchBookingSchema } from '@/lib/validations/booking';
import { bookingDetailResponse } from '@/lib/validations/booking-json';
import type { AdminBooking } from '@/types/booking-read';
import QuickActionsCard from '@/components/BookingDetails/QuickActionsCard';
import RecordPaymentModal from '@/components/RecordPaymentModal';

async function show(remainingAmount: number | null = 10.01) {
  const onRecordPayment = jest.fn().mockResolvedValue(undefined);
  const onClose = jest.fn();
  const modal = (balance: number | null) => (
    <RecordPaymentModal
      isOpen
      isLoading={false}
      onClose={onClose}
      onRecordPayment={onRecordPayment}
      totalAmount={1234.5}
      remainingAmount={balance}
      bookingId='507f1f77bcf86cd799439011'
      guestName='Avery'
    />
  );
  const view = render(modal(remainingAmount));
  fireEvent.click(screen.getByRole('button', { name: /Payment Method/ }));
  fireEvent.click(await screen.findByRole('option', { name: 'Cash' }));
  return {
    onRecordPayment,
    onClose,
    refresh: (balance: number | null) => view.rerender(modal(balance)),
  };
}

test('renders fixed ungrouped major units and submits a full balance with trimmed notes', async () => {
  const { onRecordPayment, onClose } = await show();
  expect(screen.getByText('$1234.50')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Full Amount ($10.01)' }));
  fireEvent.change(screen.getByLabelText('Payment Notes (Optional)'), {
    target: { value: '  Cash received  ' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Record Payment' }));
  await waitFor(() =>
    expect(onRecordPayment).toHaveBeenCalledWith({
      paymentMethod: 'cash',
      amountPaid: 10.01,
      notes: 'Cash received',
    })
  );
  expect(onClose).toHaveBeenCalledTimes(1);
});

test.each([
  { remaining: 10.01, paid: 5.01, label: 'Half ($5.01)' },
  { remaining: 0.29, paid: 0.15, label: 'Half ($0.15)' },
])(
  'Half rounds $remaining once and submits the amount shown in its label',
  async ({ remaining, paid, label }) => {
    const { onRecordPayment } = await show(remaining);
    const half = screen.getByRole('button', { name: /^Half/ });
    expect(half).toHaveTextContent(label);
    fireEvent.click(half);
    expect(screen.getByRole('spinbutton', { name: /Amount Paid/ })).toHaveValue(
      paid
    );
    fireEvent.click(screen.getByRole('button', { name: 'Record Payment' }));
    await waitFor(() =>
      expect(onRecordPayment).toHaveBeenCalledWith({
        paymentMethod: 'cash',
        amountPaid: paid,
        notes: undefined,
      })
    );
  }
);

test.each(['0', '-1', '1.005', '10.02', '1e309', '9007199254740991'])(
  'does not submit invalid or above-balance amount %s',
  async amount => {
    const { onRecordPayment } = await show();
    fireEvent.change(screen.getByRole('spinbutton', { name: /Amount Paid/ }), {
      target: { value: amount },
    });
    const submit = screen.getByRole('button', { name: 'Record Payment' });
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(onRecordPayment).not.toHaveBeenCalled();
  }
);

test('accepts an exact decimal cent amount without floating-point rejection', async () => {
  const { onRecordPayment } = await show();
  fireEvent.change(screen.getByRole('spinbutton', { name: /Amount Paid/ }), {
    target: { value: '0.29' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Record Payment' }));
  await waitFor(() =>
    expect(onRecordPayment).toHaveBeenCalledWith({
      paymentMethod: 'cash',
      amountPaid: 0.29,
      notes: undefined,
    })
  );
});

test('legacy fractional balances still display while a receipt must contain exact cents', async () => {
  const { onRecordPayment } = await show(1.005);
  expect(screen.getByText('$1.00')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('spinbutton', { name: /Amount Paid/ }), {
    target: { value: '1.005' },
  });
  expect(screen.getByRole('button', { name: 'Record Payment' })).toBeDisabled();
  expect(onRecordPayment).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Half ($0.50)' }));
  fireEvent.click(screen.getByRole('button', { name: 'Record Payment' }));
  await waitFor(() =>
    expect(onRecordPayment).toHaveBeenCalledWith({
      paymentMethod: 'cash',
      amountPaid: 0.5,
      notes: undefined,
    })
  );
});

test('an unavailable balance disables receipt actions without losing the same-booking draft', async () => {
  const { onRecordPayment, refresh } = await show(null);
  const submit = screen.getByRole('button', { name: 'Record Payment' });
  const amount = screen.getByRole('spinbutton', { name: /Amount Paid/ });
  const notes = screen.getByLabelText('Payment Notes (Optional)');
  expect(screen.getByText('Unavailable')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^Full Amount/ })).toBeDisabled();
  expect(screen.getByRole('button', { name: /^Half/ })).toBeDisabled();
  expect(submit).toBeDisabled();
  refresh(10);
  fireEvent.change(amount, { target: { value: '8' } });
  fireEvent.change(notes, { target: { value: 'Desk receipt' } });
  expect(submit).toBeEnabled();
  refresh(null);
  expect(submit).toBeDisabled();
  fireEvent.click(submit);
  refresh(6);
  expect(submit).toBeDisabled();
  expect(amount).toHaveValue(8);
  expect(notes).toHaveValue('Desk receipt');
  refresh(9);
  expect(onRecordPayment).not.toHaveBeenCalled();
  fireEvent.click(submit);
  await waitFor(() =>
    expect(onRecordPayment).toHaveBeenCalledWith({
      paymentMethod: 'cash',
      amountPaid: 8,
      notes: 'Desk receipt',
    })
  );
});

jest.unmock('swr');
jest.mock('@/hooks/useCabins', () => ({
  useCabin: () => ({ data: null, isLoading: false }),
}));
jest.mock('@/hooks/usePrintBooking', () => ({ usePrintBooking: () => ({}) }));
jest.mock('@/hooks/useSendEmail', () => ({
  useSendConfirmationEmail: () => ({}),
}));

test.each(['detail refresh', 'explicit original retry'] as const)(
  'a second cash draft survives an ambiguous first payment and %s',
  async recovery => {
    jest.mocked(addToast).mockClear();
    const id = '507f1f77bcf86cd799439011';
    const date = '2040-06-01T00:00:00.000Z';
    const { data: booking } = bookingDetailResponse.parse({
      success: true,
      data: {
        _id: id,
        id,
        customer: null,
        guest: null,
        cabin: null,
        checkInDate: date,
        checkOutDate: '2040-06-02T00:00:00.000Z',
        numGuests: 1,
        numNights: 1,
        cabinPrice: 100,
        totalPrice: 100,
        remainingAmount: 100,
        status: 'confirmed',
      },
    });
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const receipts = new Map<
      string,
      NonNullable<AdminBooking['payments']>[number]
    >();
    const originalFetch = global.fetch;
    const requests: { receiptId: string; notes: string }[] = [];
    const savedNotes: string[] = [];
    const detail = () =>
      bookingDetailResponse.parse({
        success: true,
        data: {
          ...booking,
          payments: Array.from(receipts.values()),
          remainingAmount: 100 - 40 * receipts.size,
        },
      });
    global.fetch = jest.fn(async (_url, init) => {
      const { recordPayment: p } = patchBookingSchema.parse(
        JSON.parse(String(init?.body))
      );
      if (!p?.receiptId || !p.notes)
        throw new Error('Expected a receipt ID and envelope note');
      requests.push({ receiptId: p.receiptId, notes: p.notes });
      const first = requests.length === 1;
      if (
        !receipts.has(p.receiptId) &&
        (!first || recovery === 'detail refresh')
      ) {
        receipts.set(p.receiptId, {
          id: p.receiptId,
          amount: p.amountPaid,
          method: p.paymentMethod,
          receivedAt: date,
        });
        savedNotes.push(p.notes);
      }
      return Response.json(first ? { success: true, data: null } : detail());
    });
    function card(current: AdminBooking) {
      return (
        <QueryClientProvider client={client}>
          <QuickActionsCard
            booking={current}
            onCheckIn={jest.fn()}
            onCheckOut={jest.fn()}
            actionLoading={null}
          />
        </QueryClientProvider>
      );
    }
    const submit = () => screen.getByRole('button', { name: 'Record Payment' });
    async function openDraft(note: string) {
      fireEvent.click(submit());
      fireEvent.click(screen.getByRole('button', { name: /Payment Method/ }));
      fireEvent.click(await screen.findByRole('option', { name: 'Cash' }));
      fireEvent.change(
        screen.getByRole('spinbutton', { name: /Amount Paid/ }),
        { target: { value: '40' } }
      );
      fireEvent.change(screen.getByLabelText('Payment Notes (Optional)'), {
        target: { value: note },
      });
    }
    const view = render(card(booking));
    try {
      await openDraft('First envelope');
      fireEvent.click(submit());
      await waitFor(() =>
        expect(addToast).toHaveBeenCalledWith(
          expect.objectContaining({ color: 'danger' })
        )
      );
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      await openDraft('Second envelope');
      expect(submit()).toBeDisabled();
      fireEvent.click(submit());
      expect(requests).toHaveLength(1);
      expect(addToast).not.toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Payment recorded successfully',
        })
      );
      if (recovery === 'detail refresh') view.rerender(card(detail().data));
      else {
        fireEvent.click(
          screen.getByRole('button', { name: 'Retry previous payment' })
        );
        await waitFor(() =>
          expect(requests).toEqual([requests[0], requests[0]])
        );
      }
      await waitFor(() => expect(submit()).toBeEnabled());
      expect(screen.getByLabelText('Payment Notes (Optional)')).toHaveValue(
        'Second envelope'
      );
      expect(receipts.size).toBe(1);
      fireEvent.click(submit());
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(new Set(requests.map(p => p.receiptId)).size).toBe(2);
      expect(savedNotes).toEqual(['First envelope', 'Second envelope']);
      expect(addToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Payment recorded successfully',
        })
      );
    } finally {
      view.unmount();
      client.clear();
      global.fetch = originalFetch;
    }
  }
);
