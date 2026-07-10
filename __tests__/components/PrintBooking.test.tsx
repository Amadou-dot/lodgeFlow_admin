import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BookingPDFTemplate from '@/components/BookingDetails/BookingPDFTemplate';
import QuickActionsCard from '@/components/BookingDetails/QuickActionsCard';
import type { PopulatedBooking } from '@/types';

// Mock the hooks
jest.mock('@/hooks/usePrintBooking', () => ({
  usePrintBooking: () => ({
    isPrinting: false,
    isGeneratingPDF: false,
    handlePrint: jest.fn(),
    handleDownloadPDF: jest.fn(),
    handleBrowserPrint: jest.fn(),
  }),
}));

jest.mock('@/hooks/useBookings', () => ({
  useBookingByEmail: () => ({
    data: null,
    isLoading: false,
  }),
  useRecordPayment: () => ({
    mutateAsync: jest.fn(),
  }),
}));

jest.mock('@/hooks/useCabins', () => ({
  useCabin: () => ({
    data: null,
    isLoading: false,
  }),
}));

jest.mock('@/hooks/useSendEmail', () => ({
  useSendConfirmationEmail: () => ({
    sendConfirmationEmail: jest.fn(),
  }),
}));

// Mock dependencies that might not be available in test environment
jest.mock('html2canvas', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('jspdf', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    addImage: jest.fn(),
    save: jest.fn(),
    internal: {
      pageSize: {
        getWidth: () => 210,
        getHeight: () => 297,
      },
    },
  })),
}));

const mockBooking: PopulatedBooking = {
  _id: '123456789012345678901234',
  status: 'confirmed',
  isPaid: false,
  checkInDate: '2024-01-15',
  checkOutDate: '2024-01-20',
  numNights: 5,
  numGuests: 2,
  cabinPrice: 500,
  extrasPrice: 50,
  totalPrice: 550,
  depositPaid: false,
  depositAmount: 0,
  remainingAmount: 550,
  customer: {
    id: 'user_123',
    first_name: 'John',
    last_name: 'Doe',
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1234567890',
    image_url: '',
    has_image: false,
    username: null,
    created_at: new Date(),
    updated_at: new Date(),
    last_sign_in_at: null,
    last_active_at: new Date(),
    banned: false,
    locked: false,
    lockout_expires_in_seconds: null,
    loyaltyTier: 'Bronze',
    totalBookings: 1,
    totalSpent: 550,
  },
  cabin: {
    _id: 'cabin_123',
    name: 'Mountain View Cabin',
    capacity: 4,
    price: 100,
    discount: 0,
    image: 'cabin.jpg',
    description: 'A beautiful cabin with mountain views',
    amenities: ['WiFi', 'Kitchen'],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any, // Type cast to avoid complex mock setup
  extras: {
    hasBreakfast: true,
    breakfastPrice: 25,
    hasPets: false,
    petFee: 0,
    hasParking: true,
    parkingFee: 25,
    hasEarlyCheckIn: false,
    earlyCheckInFee: 0,
    hasLateCheckOut: false,
    lateCheckOutFee: 0,
  },
  observations: 'Guest has dietary restrictions',
  specialRequests: ['Late checkout'],
  paymentMethod: 'card',
  createdAt: new Date(),
  updatedAt: new Date(),
} as PopulatedBooking;

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Print Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('BookingPDFTemplate', () => {
    it('renders booking details correctly', () => {
      render(
        <TestWrapper>
          <BookingPDFTemplate booking={mockBooking} />
        </TestWrapper>
      );

      // Check that essential booking information is displayed
      expect(screen.getByText('Booking Details')).toBeInTheDocument();
      // Booking ID renders as "#" + last 8 chars of the ID, uppercased,
      // split across two text nodes inside one span
      expect(
        screen.getByText(
          (_, element) =>
            element?.tagName === 'SPAN' && element.textContent === '#78901234'
        )
      ).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
      expect(screen.getByText('Mountain View Cabin')).toBeInTheDocument();
      expect(screen.getByText('$550.00')).toBeInTheDocument(); // Total price
    });

    it('displays booking status correctly', () => {
      render(
        <TestWrapper>
          <BookingPDFTemplate booking={mockBooking} />
        </TestWrapper>
      );

      expect(screen.getByText('Confirmed')).toBeInTheDocument();
    });

    it('shows extras when available', () => {
      render(
        <TestWrapper>
          <BookingPDFTemplate booking={mockBooking} />
        </TestWrapper>
      );

      expect(screen.getByText('Breakfast:')).toBeInTheDocument();
      expect(screen.getByText('Parking:')).toBeInTheDocument();
      // Breakfast and parking both cost $25.00 in the mock booking
      expect(screen.getAllByText('$25.00')).toHaveLength(2);
    });

    it('applies the correct ID for printing', () => {
      const { container } = render(
        <TestWrapper>
          <BookingPDFTemplate booking={mockBooking} id='test-print-id' />
        </TestWrapper>
      );

      const printElement = container.querySelector('#test-print-id');
      expect(printElement).toBeInTheDocument();
    });
  });

  describe('QuickActionsCard', () => {
    const defaultProps = {
      booking: mockBooking,
      onCheckIn: jest.fn(),
      onCheckOut: jest.fn(),
      actionLoading: null,
      onPaymentRecorded: jest.fn(),
    };

    it('renders print button', () => {
      render(
        <TestWrapper>
          <QuickActionsCard {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByText('Print Booking Details')).toBeInTheDocument();
    });

    it('shows check-in button for confirmed bookings', () => {
      render(
        <TestWrapper>
          <QuickActionsCard {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByText('Check In Guest')).toBeInTheDocument();
    });

    it('shows record payment button for unpaid bookings', () => {
      render(
        <TestWrapper>
          <QuickActionsCard {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByText('Record Payment')).toBeInTheDocument();
    });

    it('opens print dropdown when clicked', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <QuickActionsCard {...defaultProps} />
        </TestWrapper>
      );

      const printButton = screen.getByText('Print Booking Details');
      await user.click(printButton);

      // Check that dropdown options appear
      expect(screen.getByText('Print Booking')).toBeInTheDocument();
      expect(screen.getByText('Download as PDF')).toBeInTheDocument();
      expect(screen.getByText('Browser Print')).toBeInTheDocument();
    });
  });
});
