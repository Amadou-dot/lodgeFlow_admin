import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
