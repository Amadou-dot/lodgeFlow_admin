import { render, screen } from '@testing-library/react';
import CabinTestimonials from '@/components/CabinTestimonials';

describe('CabinTestimonials', () => {
  it('renders the section heading', () => {
    render(<CabinTestimonials />);
    expect(screen.getByText('What Guests Are Saying')).toBeInTheDocument();
  });

  it('renders 3 testimonial cards', () => {
    render(<CabinTestimonials />);
    expect(screen.getAllByRole('article')).toHaveLength(3);
  });

  it('renders reviewer names', () => {
    render(<CabinTestimonials />);
    expect(screen.getByText('Sarah M.')).toBeInTheDocument();
    expect(screen.getByText('James R.')).toBeInTheDocument();
    expect(screen.getByText('Priya K.')).toBeInTheDocument();
  });
});
