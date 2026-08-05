import { render, screen } from '@testing-library/react';
import BookingForm from '@/components/BookingForm';
import { useCreateBooking } from '@/hooks/useBooking';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

// Mock dependencies
jest.mock('@/hooks/useBooking');
jest.mock('@/hooks/useSettings', () => ({
  useSettings: jest.fn(() => ({
    data: undefined,
    isLoading: false,
    error: null,
  })),
}));
jest.mock('@clerk/nextjs');
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));
jest.mock('swr', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    data: {
      success: true,
      data: {
        cabinId: 'cabin123',
        unavailableDates: [],
        queryRange: { start: '2025-01-01', end: '2025-07-01' },
      },
    },
    error: null,
  })),
}));

const mockCabinWithoutDiscount = {
  _id: 'cabin123',
  name: 'Test Cabin',
  regularPrice: 200,
  maxCapacity: 4,
  image: 'https://example.com/image.jpg',
};

const mockCabinWithDiscount = {
  _id: 'cabin456',
  name: 'Discounted Cabin',
  regularPrice: 300,
  discount: 50,
  maxCapacity: 6,
  image: 'https://example.com/image2.jpg',
};

const mockUserData = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  phone: '1234567890',
};

const mockUser = {
  id: 'user123',
  firstName: 'John',
  lastName: 'Doe',
  emailAddresses: [{ emailAddress: 'john@example.com' }],
  phoneNumbers: [{ phoneNumber: '1234567890' }],
};

describe('BookingForm - Discount Pricing', () => {
  beforeEach(() => {
    (useUser as jest.Mock).mockReturnValue({
      isSignedIn: true,
      isLoaded: true,
      user: mockUser,
    });
    (useCreateBooking as jest.Mock).mockReturnValue({
      mutate: jest.fn(),
    });
    (useRouter as jest.Mock).mockReturnValue({
      push: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Display without discount', () => {
    it('should display regular price without strikethrough when no discount', () => {
      render(
        <BookingForm cabin={mockCabinWithoutDiscount} userData={mockUserData} />
      );

      expect(
        screen.getByText('$200/night • Up to 4 guests')
      ).toBeInTheDocument();
      expect(screen.queryByText(/Save/)).not.toBeInTheDocument();
    });

    it('should calculate total using regular price when no discount', () => {
      render(
        <BookingForm cabin={mockCabinWithoutDiscount} userData={mockUserData} />
      );

      // The pricing breakdown should show regular price without strikethrough
      const priceElements = screen.getAllByText(/\$200/);
      expect(priceElements.length).toBeGreaterThan(0);
    });
  });

  describe('Display with discount', () => {
    it('should display original price with strikethrough when discount exists', () => {
      render(
        <BookingForm cabin={mockCabinWithDiscount} userData={mockUserData} />
      );

      const strikethroughPrice = screen.getByText('$300');
      expect(strikethroughPrice).toHaveClass('line-through');
    });

    it('should display discounted price prominently', () => {
      render(
        <BookingForm cabin={mockCabinWithDiscount} userData={mockUserData} />
      );

      expect(screen.getByText('$250/night')).toBeInTheDocument();
    });

    it('should display savings message', () => {
      render(
        <BookingForm cabin={mockCabinWithDiscount} userData={mockUserData} />
      );

      expect(screen.getByText('Save $50/night!')).toBeInTheDocument();
    });

    it('should show capacity information separately when discount exists', () => {
      render(
        <BookingForm cabin={mockCabinWithDiscount} userData={mockUserData} />
      );

      expect(screen.getByText('Up to 6 guests')).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should handle zero discount gracefully', () => {
      const cabinWithZeroDiscount = {
        ...mockCabinWithoutDiscount,
        discount: 0,
      };

      render(
        <BookingForm cabin={cabinWithZeroDiscount} userData={mockUserData} />
      );

      expect(screen.queryByText(/Save/)).not.toBeInTheDocument();
      expect(
        screen.getByText('$200/night • Up to 4 guests')
      ).toBeInTheDocument();
    });

    it('should handle 100% discount (free cabin)', () => {
      const freeCabin = {
        ...mockCabinWithoutDiscount,
        regularPrice: 100,
        discount: 100,
      };

      render(<BookingForm cabin={freeCabin} userData={mockUserData} />);

      expect(screen.getByText('$0/night')).toBeInTheDocument();
      expect(screen.getByText('Save $100/night!')).toBeInTheDocument();
    });

    it('should handle undefined discount (treat as 0)', () => {
      const cabinUndefinedDiscount = {
        _id: 'cabin789',
        name: 'Test Cabin',
        regularPrice: 150,
        maxCapacity: 2,
      };

      render(
        <BookingForm cabin={cabinUndefinedDiscount} userData={mockUserData} />
      );

      expect(screen.queryByText(/Save/)).not.toBeInTheDocument();
    });
  });

  describe('User not signed in', () => {
    it('should show sign-in message when user is not authenticated', () => {
      (useUser as jest.Mock).mockReturnValue({
        isSignedIn: false,
        isLoaded: true,
        user: null,
      });

      render(
        <BookingForm cabin={mockCabinWithDiscount} userData={undefined} />
      );

      expect(
        screen.getByText('Please sign in to book this cabin.')
      ).toBeInTheDocument();
    });
  });
});
