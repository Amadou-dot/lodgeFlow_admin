import { render, renderHook, screen } from '@testing-library/react';
import type { AdminBooking } from '@/types/booking-read';
import { useBookingForm } from '@/hooks/useBookingForm';
import CabinInformationCard from '@/components/BookingDetails/CabinInformationCard';
import BookingHistoryCard from '@/components/BookingDetails/BookingHistoryCard';
import GuestInformationCard from '@/components/BookingDetails/GuestInformationCard';

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
      customer={{ id: 'user_deleted', name: 'Unknown User', email: 'N/A' }}
      numGuests={2}
      numNights={2}
    />
  );
  expect(screen.getByText('Unknown User')).toBeInTheDocument();
  expect(screen.getByText('N/A')).toBeInTheDocument();
});
