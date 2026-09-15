import { render, screen } from '@testing-library/react';
import CabinBookingSteps from '@/components/CabinBookingSteps';

describe('CabinBookingSteps', () => {
  it('renders section heading', () => {
    render(<CabinBookingSteps />);
    expect(screen.getByText('How Booking Works')).toBeInTheDocument();
  });

  it('renders all 4 step numbers', () => {
    render(<CabinBookingSteps />);
    ['1', '2', '3', '4'].forEach(n => {
      expect(screen.getByText(n)).toBeInTheDocument();
    });
  });

  it('renders all step titles', () => {
    render(<CabinBookingSteps />);
    expect(screen.getByText('Select Dates & Guests')).toBeInTheDocument();
    expect(screen.getByText('Review Your Details')).toBeInTheDocument();
    expect(screen.getByText('Secure Payment')).toBeInTheDocument();
    expect(screen.getByText('Instant Confirmation')).toBeInTheDocument();
  });
});
