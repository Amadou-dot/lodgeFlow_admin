import { render } from '@testing-library/react';
import BookingForm from '@/components/BookingForm';
import { useCreateBooking } from '@/hooks/useBooking';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

jest.mock('@/hooks/useBooking');
jest.mock('@/hooks/useIsMobile');
jest.mock('@/hooks/useSettings', () => ({
  useSettings: jest.fn(() => ({
    data: undefined,
    isLoading: false,
    error: null,
  })),
}));
jest.mock('@clerk/nextjs');
jest.mock('next/navigation', () => ({ useRouter: jest.fn() }));
jest.mock('swr', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    data: {
      success: true,
      data: {
        cabinId: 'c1',
        unavailableDates: [],
        queryRange: { start: '2025-01-01', end: '2025-07-01' },
      },
    },
    error: null,
  })),
}));

let capturedProps: Record<string, unknown> = {};
jest.mock('@heroui/date-picker', () => ({
  DateRangePicker: (props: Record<string, unknown>) => {
    capturedProps = props;
    return <div data-testid='date-range-picker' />;
  },
}));

const mockCabin = {
  _id: 'c1',
  name: 'Test Cabin',
  regularPrice: 200,
  maxCapacity: 4,
};
const mockUser = {
  id: 'u1',
  firstName: 'John',
  lastName: 'Doe',
  emailAddresses: [{ emailAddress: 'j@example.com' }],
  phoneNumbers: [{ phoneNumber: '123' }],
};

beforeEach(() => {
  capturedProps = {};
  (useUser as jest.Mock).mockReturnValue({
    isSignedIn: true,
    isLoaded: true,
    user: mockUser,
  });
  (useCreateBooking as jest.Mock).mockReturnValue({ mutate: jest.fn() });
  (useRouter as jest.Mock).mockReturnValue({ push: jest.fn() });
});

describe('BookingForm - responsive DateRangePicker', () => {
  it('uses visibleMonths=1 on mobile', () => {
    (useIsMobile as jest.Mock).mockReturnValue(true);
    render(<BookingForm cabin={mockCabin} />);
    expect(capturedProps.visibleMonths).toBe(1);
  });

  it('uses visibleMonths=2 on desktop', () => {
    (useIsMobile as jest.Mock).mockReturnValue(false);
    render(<BookingForm cabin={mockCabin} />);
    expect(capturedProps.visibleMonths).toBe(2);
  });

  it('omits calendarWidth on mobile', () => {
    (useIsMobile as jest.Mock).mockReturnValue(true);
    render(<BookingForm cabin={mockCabin} />);
    expect(capturedProps.calendarWidth).toBeUndefined();
  });

  it('uses calendarWidth=400 on desktop', () => {
    (useIsMobile as jest.Mock).mockReturnValue(false);
    render(<BookingForm cabin={mockCabin} />);
    expect(capturedProps.calendarWidth).toBe(400);
  });
});
