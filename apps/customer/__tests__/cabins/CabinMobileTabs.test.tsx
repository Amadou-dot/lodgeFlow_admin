import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CabinMobileTabs from '@/components/CabinMobileTabs';
import type { Cabin } from '@/types';

jest.mock('@/components/CabinDetails', () => ({
  CabinDescriptionSection: () => (
    <div data-testid='description-section'>Description</div>
  ),
  CabinInfoSection: () => <div data-testid='info-section'>Info</div>,
  CabinHouseRulesSection: () => (
    <div data-testid='house-rules-section'>House Rules</div>
  ),
  CabinAmenitiesSection: () => (
    <div data-testid='amenities-section'>Amenities</div>
  ),
}));

jest.mock('@/components/BookingForm', () => {
  return function MockBookingForm() {
    return <div data-testid='booking-form'>Booking Form</div>;
  };
});

const mockCabin = {
  _id: 'cabin-123',
  name: 'Test Cabin',
  price: 200,
  capacity: 4,
  image: '/cabin.jpg',
  discount: 0,
  description: 'A test cabin.',
  amenities: ['WiFi'],
} as unknown as Cabin;

const mockBookingCabin = {
  _id: 'cabin-123',
  name: 'Test Cabin',
  regularPrice: 200,
  maxCapacity: 4,
  image: '/cabin.jpg',
};

describe('CabinMobileTabs', () => {
  it('renders three tabs with correct labels', () => {
    render(
      <CabinMobileTabs bookingCabin={mockBookingCabin} cabin={mockCabin} />
    );
    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByText('Amenities')).toBeInTheDocument();
    expect(screen.getByText('Book')).toBeInTheDocument();
  });

  it('shows Details content by default', () => {
    render(
      <CabinMobileTabs bookingCabin={mockBookingCabin} cabin={mockCabin} />
    );
    expect(screen.getByTestId('description-section')).toBeInTheDocument();
    expect(screen.getByTestId('info-section')).toBeInTheDocument();
  });

  it('shows BookingForm when Book tab is clicked', async () => {
    render(
      <CabinMobileTabs bookingCabin={mockBookingCabin} cabin={mockCabin} />
    );
    await userEvent.click(screen.getByText('Book'));
    expect(screen.getByTestId('booking-form')).toBeInTheDocument();
  });

  it('has 3 tab roles for accessibility', () => {
    render(
      <CabinMobileTabs bookingCabin={mockBookingCabin} cabin={mockCabin} />
    );
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });
});
