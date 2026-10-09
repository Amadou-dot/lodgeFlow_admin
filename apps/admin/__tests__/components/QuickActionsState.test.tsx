import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ComponentProps } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
} from '@tanstack/react-query';
import type RecordPaymentModal from '@/components/RecordPaymentModal';
import type { PaymentData } from '@/components/RecordPaymentModal';
import type { PopulatedBooking } from '@/types';
import QuickActionsCard from '@/components/BookingDetails/QuickActionsCard';
const booking: PopulatedBooking = {
  _id: 'booking',
  id: 'booking',
  guest: null,
  cabin: null,
  customer: null,
  checkInDate: '2040-01-01',
  checkOutDate: '2040-01-02',
  numNights: 1,
  numGuests: 1,
  status: 'confirmed',
  cabinPrice: 10,
  extrasPrice: 0,
  totalPrice: 10,
  depositAmount: 0,
  amountPaid: 0,
  remainingAmount: 10,
  isPaid: false,
  depositPaid: false,
};
const mockPayment = jest.fn<
  Promise<void>,
  [PaymentData & { bookingId: string }]
>();
const mockPDF = jest.fn<Promise<void>, [string]>();
jest.mock('@/hooks/useBookings', () => ({
  useBookingByEmail: () => ({ data: null, isLoading: false }),
  useRecordPayment: () => useMutation({ mutationFn: mockPayment }),
}));
jest.mock('@/hooks/useCabins', () => ({
  useCabin: () => ({ data: null, isLoading: false }),
}));
jest.mock('@/hooks/useSendEmail', () => ({
  useSendConfirmationEmail: () => ({ sendConfirmationEmail: jest.fn() }),
}));
jest.mock('@/hooks/usePrintBooking', () => ({
  usePrintBooking: () => ({
    isPrinting: false,
    isGeneratingPDF: false,
    handlePrint: jest.fn(),
    handleDownloadPDF: mockPDF,
    handleBrowserPrint: jest.fn(),
  }),
}));
jest.mock('@/components/BookingDetails/BookingPDFTemplate', () => ({
  __esModule: true,
  default: () => <p>PDF content</p>,
}));
jest.mock('@/components/RecordPaymentModal', () => ({
  __esModule: true,
  default: ({
    onRecordPayment,
    onClose,
    isLoading,
  }: ComponentProps<typeof RecordPaymentModal>) => (
    <section role='dialog' aria-label='Payment'>
      <button onClick={onClose}>Cancel payment</button>
      <button
        disabled={isLoading}
        onClick={() =>
          void onRecordPayment({ paymentMethod: 'cash', amountPaid: 1 })
            .then(onClose)
            .catch(() => {})
        }
      >
        {isLoading ? 'Recording payment' : 'Submit payment'}
      </button>
    </section>
  ),
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockPayment.mockResolvedValue(undefined);
  mockPDF.mockResolvedValue(undefined);
});
function show() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const refresh = jest.fn();
  render(
    <QueryClientProvider client={client}>
      <QuickActionsCard
        booking={booking}
        onCheckIn={jest.fn()}
        onCheckOut={jest.fn()}
        actionLoading={null}
        onPaymentRecorded={refresh}
      />
    </QueryClientProvider>
  );
  return refresh;
}
test('payment pending follows its mutation and failed submission keeps the dialog retryable', async () => {
  mockPayment.mockRejectedValueOnce(new Error('Payment failed'));
  const refresh = show();
  fireEvent.click(screen.getByRole('button', { name: 'Record Payment' }));
  fireEvent.click(screen.getByRole('button', { name: 'Submit payment' }));
  await waitFor(() => expect(mockPayment).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Submit payment' })
    ).not.toBeDisabled()
  );
  expect(refresh).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Submit payment' }));
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  expect(mockPayment).toHaveBeenNthCalledWith(
    1,
    { bookingId: 'booking', paymentMethod: 'cash', amountPaid: 1 },
    expect.anything()
  );
  expect(
    screen.queryByRole('dialog', { name: 'Payment' })
  ).not.toBeInTheDocument();
});
test('print preview replaces payment, failed PDF stays open and succeeds on retry', async () => {
  mockPDF.mockRejectedValueOnce(new Error('Canvas failed'));
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Record Payment' }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Print Booking Details' })
  );
  fireEvent.click(
    await screen.findByRole('menuitem', { name: 'Print Booking' })
  );
  await screen.findByText('Print Preview');
  expect(
    screen.queryByRole('dialog', { name: 'Payment' })
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
  await act(async () => {});
  expect(screen.getByText('Print Preview')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  );
});
test('payment completion cannot close a newly opened print session', async () => {
  let finish: () => void = () => {
    throw new Error('not started');
  };
  mockPayment.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      })
  );
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Record Payment' }));
  fireEvent.click(screen.getByRole('button', { name: 'Submit payment' }));
  await screen.findByRole('button', { name: 'Recording payment' });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel payment' }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Print Booking Details' })
  );
  fireEvent.click(
    await screen.findByRole('menuitem', { name: 'Print Booking' })
  );
  await screen.findByText('Print Preview');
  await act(async () => {
    finish();
  });
  expect(screen.getByText('Print Preview')).toBeInTheDocument();
});
