import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { BookingHistoryItem } from '@/types/booking-read';
import BookingsPage from '@/app/bookings/page';

const mockUpdateBooking = jest.fn();

const mockBooking: BookingHistoryItem = {
  _id: '507f1f77bcf86cd799439011',
  customer: 'user_customer',
  checkInDate: '2030-01-01T00:00:00.000Z',
  checkOutDate: '2030-01-03T00:00:00.000Z',
  numNights: 2,
  numGuests: 2,
  status: 'unconfirmed',
  cabinPrice: 200,
  totalPrice: 200,
  cabin: {
    _id: '507f1f77bcf86cd799439012',
    name: 'Pine',
    image: 'https://example.com/pine.jpg',
    images: [],
    capacity: 4,
    price: 100,
    discount: 0,
    description: 'Forest cabin',
    status: 'active',
  },
};

jest.mock('@heroui/button', () => ({
  Button: ({
    children,
    onPress,
  }: {
    children: React.ReactNode;
    onPress?: () => void;
  }) => <button onClick={onPress}>{children}</button>,
}));
jest.mock('@heroui/modal', () => {
  const { useState } = jest.requireActual<typeof import('react')>('react');
  const Container = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Modal: ({
      isOpen,
      children,
    }: {
      isOpen: boolean;
      children: React.ReactNode;
    }) => (isOpen ? <div>{children}</div> : null),
    ModalContent: ({
      children,
    }: {
      children: (close: () => void) => React.ReactNode;
    }) => <div>{children(() => {})}</div>,
    ModalHeader: Container,
    ModalBody: Container,
    ModalFooter: Container,
    useDisclosure: () => {
      const [isOpen, setOpen] = useState(false);
      return {
        isOpen,
        onOpen: () => setOpen(true),
        onClose: () => setOpen(false),
      };
    },
  };
});
jest.mock('@heroui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tab: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock('@/hooks/useBooking', () => ({
  useBookingHistory: () => ({
    data: [mockBooking],
    isLoading: false,
    error: null,
  }),
  useCancelBooking: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useUpdateBooking: () => ({
    mutateAsync: mockUpdateBooking,
    isPending: false,
  }),
}));
jest.mock('@/hooks/useDiningReservation', () => ({
  useDiningReservationHistory: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  useCancelDiningReservation: () => ({ mutateAsync: jest.fn() }),
}));
jest.mock('@/hooks/useExperienceBooking', () => ({
  useExperienceBookingHistory: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  useCancelExperienceBooking: () => ({ mutateAsync: jest.fn() }),
}));
jest.mock('@/components/PaymentButton', () => ({
  __esModule: true,
  default: () => <button>Pay</button>,
}));
jest.mock('@heroui/date-picker', () => ({ DatePicker: () => <div /> }));

describe('booking history JSON in the bookings page', () => {
  beforeEach(() => mockUpdateBooking.mockReset());

  it('only offers supported guest edits and submits no ignored dates or notes', async () => {
    mockUpdateBooking.mockResolvedValue({ success: true });
    const { container } = render(<BookingsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(await screen.findByRole('spinbutton'), {
      target: { value: '3' },
    });
    expect(container.querySelector('input[type="date"]')).toBeNull();
    expect(
      screen.queryByPlaceholderText('Any special requests or notes...')
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Update Booking' }));
    await waitFor(() =>
      expect(mockUpdateBooking).toHaveBeenCalledWith({
        bookingId: mockBooking._id,
        updates: { numGuests: 3 },
      })
    );
  });
  it('uses the persisted cabin capacity when editing a booking', async () => {
    render(<BookingsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(await screen.findByRole('spinbutton')).toHaveAttribute('max', '4');
    expect(
      screen.getByText(/Maximum capacity:.*4.*guests/)
    ).toBeInTheDocument();
  });

  it('renders a booking whose populated cabin no longer exists', () => {
    const cabin = mockBooking.cabin;
    mockBooking.cabin = null;
    try {
      render(<BookingsPage />);
      expect(screen.getByRole('img', { name: 'Cabin' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'View Details' }));
      expect(screen.getByText('Booking Details')).toBeInTheDocument();
    } finally {
      mockBooking.cabin = cabin;
    }
  });
});
