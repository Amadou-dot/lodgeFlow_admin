import { render, screen } from '@testing-library/react';
import { useState } from 'react';
let mockId: string | undefined;
const mockRead = jest.fn();
jest.mock('next/navigation', () => ({
  useParams: () => ({ id: mockId }),
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('@/hooks/useBookings', () => ({
  useBooking: (id: string) => {
    useState(0);
    mockRead(id);
    return { isLoading: true };
  },
  useCheckInBooking: () => ({}),
  useCheckOutBooking: () => ({}),
  useDeleteBooking: () => ({}),
}));
jest.mock('@/hooks/useDetailPageMemory', () => ({
  useDetailPageMemory: () => {},
}));
jest.mock('@/components/BookingDetails', () => ({
  BookingDetailsHeader: () => null,
  BookingMainContent: () => null,
  BookingSidebar: () => null,
}));
import BookingDetailsPage from '@/app/(dashboard)/bookings/[id]/page';
test('the detail read hook runs before the missing-ID return across route context changes', () => {
  mockId = undefined;
  const { rerender } = render(<BookingDetailsPage />);
  expect(screen.getByText('Invalid Booking ID')).toBeInTheDocument();
  expect(mockRead).toHaveBeenLastCalledWith('');
  mockId = 'booking';
  rerender(<BookingDetailsPage />);
  expect(mockRead).toHaveBeenLastCalledWith('booking');
  expect(screen.getByText('Loading booking details...')).toBeInTheDocument();
});
