import { render, renderHook, screen } from '@testing-library/react';
import type { AdminBooking } from '@/types/booking-read';
import { useBookingForm } from '@/hooks/useBookingForm';
import CabinInformationCard from '@/components/BookingDetails/CabinInformationCard';
import BookingHistoryCard from '@/components/BookingDetails/BookingHistoryCard';
import GuestInformationCard from '@/components/BookingDetails/GuestInformationCard';
import BookingStatusDates from '@/components/BookingDetails/BookingStatusDates';
import BookingCard from '@/components/BookingsTable/BookingCard';
import BookingTableCell from '@/components/BookingsTable/BookingTableCell';

jest.mock('@/hooks/useCabins', () => ({
  useCabins: () => ({ data: undefined }),
}));
jest.mock('@/hooks/useInfiniteCustomers', () => ({
  useInfiniteCustomers: () => ({
    customers: [],
    hasMore: false,
    isLoading: false,
    onLoadMore: jest.fn(),
    searchCustomers: jest.fn(),
  }),
}));
jest.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({ data: undefined }),
}));
jest.mock('@heroui/use-infinite-scroll', () => ({
  useInfiniteScroll: () => [false, { current: null }],
}));

const booking: AdminBooking = {
  _id: '507f1f77bcf86cd799439011',
  id: '507f1f77bcf86cd799439011',
  checkInDate: '2040-06-01T00:00:00.000Z',
  checkOutDate: '2040-06-03T00:00:00.000Z',
  numNights: 2,
  numGuests: 2,
  status: 'confirmed',
  cabinPrice: 400,
  extrasPrice: 0,
  totalPrice: 400,
  isPaid: false,
  amountPaid: 100,
  depositPaid: true,
  depositAmount: 100,
  remainingAmount: 300,
  cabin: null,
  customer: null,
  guest: null,
};

test('booking form handles missing references while keeping date-only and receipt flags', () => {
  const { result } = renderHook(() => useBookingForm(booking));
  expect(result.current.formData).toMatchObject({
    cabin: '',
    customer: '',
    checkInDate: '2040-06-01',
    checkOutDate: '2040-06-03',
    numGuests: 2,
    isPaid: false,
    depositPaid: true,
  });
});

test('desktop and mobile booking lists show the planned UTC stay range', () => {
  const stay = {
    ...booking,
    checkInDate: '2027-03-20T00:00:00.000Z',
    checkOutDate: '2027-03-23T00:00:00.000Z',
    numNights: 3,
  };

  render(
    <>
      <BookingTableCell booking={stay} columnKey='dates' />
      <BookingCard booking={stay} />
    </>
  );

  expect(screen.getAllByText('Mar 20, 2027 — Mar 23, 2027')).toHaveLength(2);
  expect(screen.getAllByText(/→ 3 nights stay/)).toHaveLength(2);
});

test('booking details show UTC stay labels and local check-in time', () => {
  const checkInTime = '2027-03-20T00:30:00.000Z';

  render(
    <BookingStatusDates
      status='checked-in'
      isPaid={false}
      depositPaid
      checkInDate='2027-03-20T00:00:00.000Z'
      checkOutDate='2027-03-23T00:00:00.000Z'
      checkInTime={checkInTime}
      numNights={3}
      dateRange='Mar 20, 2027 — Mar 23, 2027'
      timeInfo='about 1 hour ago → 3 nights stay'
    />
  );

  expect(screen.getByText('Saturday, March 20, 2027')).toBeInTheDocument();
  expect(screen.getByText('Tuesday, March 23, 2027')).toBeInTheDocument();
  const localTime = new Date(checkInTime).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  expect(screen.getByText(`Checked in: ${localTime}`)).toBeInTheDocument();
});

test('booking details retain the malformed planned-date fallback and padded day', () => {
  render(
    <BookingStatusDates
      status='confirmed'
      isPaid={false}
      depositPaid
      checkInDate='bad-date'
      checkOutDate='2027-01-03T00:00:00.000Z'
      numNights={3}
      dateRange=''
      timeInfo=''
    />
  );

  expect(screen.getByText('Invalid date')).toBeInTheDocument();
  expect(screen.getByText('Sunday, January 03, 2027')).toBeInTheDocument();
});

test('missing cabin and timestamps render explicit fallback text', () => {
  render(
    <>
      <CabinInformationCard cabinPrice={400} />
      <BookingHistoryCard />
    </>
  );
  expect(screen.getByText('Cabin no longer available')).toBeInTheDocument();
  expect(screen.getAllByText('Unknown')).toHaveLength(2);
});

test('minimal list customer fallback renders without document or Date fields', () => {
  render(
    <GuestInformationCard
      customer={{ id: 'user_deleted', name: 'Unavailable guest', email: 'N/A' }}
      numGuests={2}
      numNights={2}
    />
  );
  expect(screen.getByText('Unavailable guest')).toBeInTheDocument();
  expect(screen.getByText('N/A')).toBeInTheDocument();
});
