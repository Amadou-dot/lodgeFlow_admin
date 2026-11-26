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
import type { Cabin, PopulatedBooking } from '@/types';
import type { BookingByEmail } from '@/types/booking-read';
import { addToast } from '@heroui/toast';
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
const mockReceiptRender = jest.fn<
  void,
  [
    {
      onReconciled: () => void;
      booking: PopulatedBooking;
      dialogId: symbol | null;
    },
  ]
>();
const mockPDF = jest.fn<Promise<void>, [string]>();
const mockBookingByEmail = jest.fn<
  { data: BookingByEmail | null; isLoading: boolean },
  []
>();
const mockCabin = jest.fn<{ data: Cabin | null; isLoading: boolean }, []>();
const originalFetch = global.fetch;
jest.mock('@/hooks/useBookings', () => ({
  useBookingByEmail: () => mockBookingByEmail(),
  useRecordPayment: (options: {
    dialogId: symbol | null;
    onReconciled: () => void;
    booking: PopulatedBooking;
  }) => {
    mockReceiptRender(options);
    return useMutation({ mutationFn: mockPayment });
  },
}));
jest.mock('@/hooks/useCabins', () => ({
  useCabin: () => mockCabin(),
}));
jest.mock('@/hooks/usePrintBooking', () => ({
  usePrintBooking: () => ({
    isPrinting: false,
    isGeneratingPDF: false,
    handlePrint: jest.fn(),
    handleDownloadPDF: mockPDF,
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
  mockBookingByEmail.mockReturnValue({ data: null, isLoading: false });
  mockCabin.mockReturnValue({ data: null, isLoading: false });
});
afterEach(() => {
  global.fetch = originalFetch;
});
function show(selected = booking) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const refresh = jest.fn();
  render(
    <QueryClientProvider client={client}>
      <QuickActionsCard
        booking={selected}
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
  fireEvent.click(screen.getByRole('button', { name: 'Print / Download' }));
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
  fireEvent.click(screen.getByRole('button', { name: 'Print / Download' }));
  await screen.findByText('Print Preview');
  await act(async () => {
    finish();
  });
  expect(screen.getByText('Print Preview')).toBeInTheDocument();
});

test('a null booking status keeps staff receipt access without offering a status transition', () => {
  show({ ...booking, status: null });
  expect(screen.getByRole('button', { name: 'Record Payment' })).toBeEnabled();
  expect(
    screen.queryByRole('button', { name: /Check (In|Out) Guest/ })
  ).not.toBeInTheDocument();
});

test('reconciliation closes the submitting draft while preserving a newer payment dialog', () => {
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Record Payment' }));
  const previous = mockReceiptRender.mock.lastCall?.[0];
  if (!previous) throw new Error('Missing receipt dialog');
  expect(previous.booking).toEqual(booking);
  expect(typeof previous.dialogId).toBe('symbol');
  act(previous.onReconciled);
  expect(
    screen.queryByRole('dialog', { name: 'Payment' })
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Record Payment' }));
  expect(mockReceiptRender.mock.lastCall?.[0].dialogId).not.toBe(
    previous.dialogId
  );
  act(previous.onReconciled);
  expect(screen.getByRole('dialog', { name: 'Payment' })).toBeInTheDocument();
  expect(mockPayment).not.toHaveBeenCalled();
});

test.each([
  {
    body: { id: 'email-provider-id' },
    color: 'success',
    description: 'Confirmation email sent successfully',
  },
  {
    body: {},
    color: 'danger',
    description: 'Email Failed to send: Failed to send confirmation email',
  },
])(
  'shows $color feedback for the manual send response $body',
  async ({ body, color, description }) => {
    const customer = {
      id: 'user_guest',
      name: 'Rae Guest',
      email: 'guest@example.invalid',
      first_name: 'Rae',
    };
    const cabinId = '507f1f77bcf86cd7994390ab';
    const cabin: Cabin = {
      _id: cabinId,
      id: cabinId,
      name: 'Lake Cabin',
      image: '/lake-cabin.jpg',
      images: [],
      capacity: 4,
      price: 10,
      discount: 0,
      description: 'Quiet cabin',
      status: 'active',
      amenities: [],
    };
    mockBookingByEmail.mockReturnValue({
      data: {
        ...booking,
        _id: '507f1f77bcf86cd7994390ac',
        checkInDate: '2040-01-01T00:00:00.000Z',
        checkOutDate: '2040-01-02T00:00:00.000Z',
        customer: customer.id,
        cabin,
      },
      isLoading: false,
    });
    mockCabin.mockReturnValue({ data: cabin, isLoading: false });
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => body,
    } satisfies Pick<Response, 'ok' | 'json'>);
    global.fetch = fetchMock;
    show({ ...booking, customer });
    fireEvent.click(
      screen.getByRole('button', { name: 'Send Confirmation Email' })
    );

    await waitFor(() =>
      expect(addToast).toHaveBeenCalledWith({ color, description })
    );
    expect(addToast).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/send/confirm',
      expect.objectContaining({ method: 'POST' })
    );
  }
);
