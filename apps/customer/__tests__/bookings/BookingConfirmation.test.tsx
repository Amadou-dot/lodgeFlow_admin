import { render, screen, within } from '@/__tests__/shared/test-utils';
import BookingConfirmation from '@/app/cabins/confirmation/[id]/page';
import { createCabinFixture } from '@/__tests__/shared/cabin-fixture';
import { mockBrowserTimeZone } from '@/__tests__/shared/browser-time-zone';
import type { BookingDetail } from '@/types/booking-read';

jest.mock('@/hooks/usePayment', () => ({
  useCreateCheckoutSession: () => ({
    isPending: false,
    mutateAsync: jest.fn(),
  }),
}));

function bookingFixture(overrides: Partial<BookingDetail> = {}): BookingDetail {
  return {
    _id: '507f1f77bcf86cd799439011',
    id: '507f1f77bcf86cd799439011',
    customer: 'test-user-id',
    cabin: createCabinFixture({ price: 180, extraGuestFee: 20 }),
    checkInDate: '2030-01-10T00:00:00.000Z',
    checkOutDate: '2030-01-13T00:00:00.000Z',
    numNights: 3,
    numGuests: 2,
    status: 'unconfirmed',
    cabinPrice: 180,
    extrasPrice: 150,
    totalPrice: 690,
    depositAmount: 138,
    amountPaid: 0,
    isPaid: false,
    depositPaid: false,
    extras: {
      hasBreakfast: true,
      breakfastPrice: 90,
      hasPets: false,
      petFee: 0,
      hasParking: false,
      parkingFee: 0,
      hasEarlyCheckIn: false,
      earlyCheckInFee: 0,
      hasLateCheckOut: false,
      lateCheckOutFee: 0,
    },
    specialRequests: ['Quiet room', 'Late arrival'],
    ...overrides,
  };
}

async function renderBooking(booking = bookingFixture()) {
  jest.mocked(fetch).mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, data: booking }),
  } as Response);
  render(<BookingConfirmation params={Promise.resolve({ id: booking._id })} />);
  await screen.findByText('Booking Summary');
}

beforeEach(() => jest.mocked(fetch).mockReset());
afterEach(() => jest.restoreAllMocks());

it.each(['America/Denver', 'Asia/Tokyo'])(
  'preserves UTC stay dates in %s',
  async zone => {
    mockBrowserTimeZone(zone);
    await renderBooking();
    expect(screen.getByText('Thursday, January 10, 2030')).toBeInTheDocument();
    expect(screen.getByText('Sunday, January 13, 2030')).toBeInTheDocument();
  }
);

it('renders saved request lines, services, totals and the outstanding deposit', async () => {
  await renderBooking();
  expect(screen.getByText('Breakfast ($90)')).toBeInTheDocument();
  expect(
    within(screen.getByRole('list'))
      .getAllByRole('listitem')
      .map(item => item.textContent)
  ).toEqual(['Quiet room', 'Late arrival']);
  expect(
    screen.getByText('Total (before taxes)').parentElement
  ).toHaveTextContent('$690');
  expect(
    screen.getByRole('button', { name: 'Pay Deposit ($138)' })
  ).toBeInTheDocument();
});

it('keeps a removed-cabin booking readable without offering unavailable checkout', async () => {
  await renderBooking(bookingFixture({ cabin: null }));
  expect(screen.getByText('Removed cabin')).toBeInTheDocument();
  expect(
    screen.getByRole('img', { name: 'Removed cabin' })
  ).toBeInTheDocument();
  expect(screen.getByText('507f1f77bcf86cd799439011')).toBeInTheDocument();
  expect(
    screen.getByText('Total (before taxes)').parentElement
  ).toHaveTextContent('$690');
  expect(
    screen.getByRole('link', { name: 'View My Bookings' })
  ).toHaveAttribute('href', '/bookings');
  expect(screen.queryByRole('button', { name: /Pay/ })).not.toBeInTheDocument();
});

it.each([undefined, null])(
  'renders legacy optional fields with extras %s',
  async extras => {
    await renderBooking(
      bookingFixture({
        extras,
        specialRequests: undefined,
        extrasPrice: undefined,
        depositAmount: undefined,
      })
    );
    expect(
      screen.queryByText('Additional Services & Requests')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Deposit Required')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Pay Now ($690)' })
    ).toBeInTheDocument();
  }
);

it.each([
  { isPaid: true },
  { status: 'cancelled' as const },
  { amountPaid: 690 },
])('does not offer payment when no amount is payable: %j', async overrides => {
  await renderBooking(bookingFixture(overrides));
  expect(screen.queryByRole('button', { name: /Pay/ })).not.toBeInTheDocument();
});
