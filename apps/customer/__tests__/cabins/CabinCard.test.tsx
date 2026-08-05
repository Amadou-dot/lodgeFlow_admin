import { render, screen } from '@/__tests__/shared/test-utils';
import CabinCard from '@/components/CabinCard';

const mockCabin = {
  _id: '1',
  name: 'Mountain View Cabin',
  description: 'A beautiful cabin with stunning mountain views',
  price: 200,
  discount: 20,
  capacity: 4,
  image: '/images/cabin1.jpg',
  amenities: ['WiFi', 'Kitchen', 'Fireplace', 'Hot Tub', 'Parking'],
} as any;

describe('CabinCard', () => {
  it('renders cabin information correctly', () => {
    render(<CabinCard cabin={mockCabin} />);

    expect(screen.getByText('Mountain View Cabin')).toBeInTheDocument();
    expect(
      screen.getByText('A beautiful cabin with stunning mountain views')
    ).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('displays discount badge when discount is available', () => {
    render(<CabinCard cabin={mockCabin} />);

    expect(screen.getByText('$20 OFF')).toBeInTheDocument();
  });

  it('shows discounted price correctly', () => {
    render(<CabinCard cabin={mockCabin} />);

    // Original price (crossed out)
    expect(screen.getByText('$200/night')).toBeInTheDocument();
    // Discounted price
    expect(screen.getByText('$180/night')).toBeInTheDocument();
  });

  it('renders amenities correctly', () => {
    render(<CabinCard cabin={mockCabin} />);

    expect(screen.getByText('WiFi')).toBeInTheDocument();
    expect(screen.getByText('Kitchen')).toBeInTheDocument();
    expect(screen.getByText('Fireplace')).toBeInTheDocument();
    expect(screen.getByText('+2 more')).toBeInTheDocument();
  });

  it('does not show discount badge when no discount', () => {
    const cabinWithoutDiscount = {
      ...mockCabin,
      discount: 0,
    };

    render(<CabinCard cabin={cabinWithoutDiscount} />);

    expect(screen.queryByText('$20 OFF')).not.toBeInTheDocument();
  });

  it('renders view details button with correct link', () => {
    render(<CabinCard cabin={mockCabin} />);

    const button = screen.getByRole('button', { name: /view details & book/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('href', '/cabins/1');
  });

  it('renders cabin image with correct alt text', () => {
    render(<CabinCard cabin={mockCabin} />);

    const image = screen.getByAltText('Mountain View Cabin');
    expect(image).toBeInTheDocument();
  });

  it('handles cabin with no amenities', () => {
    const cabinWithoutAmenities = {
      ...mockCabin,
      amenities: [],
    };

    render(<CabinCard cabin={cabinWithoutAmenities} />);

    expect(screen.queryByText('WiFi')).not.toBeInTheDocument();
  });

  it('shows Popular badge for cabins that qualify', () => {
    const popularCabin = { ...mockCabin, _id: '0000000000000000000000f0' }; // "00f0" → 240 % 10 = 0 → popular
    render(<CabinCard cabin={popularCabin} />);
    expect(screen.getByText('Popular')).toBeInTheDocument();
  });

  it('does not show Popular badge for non-qualifying cabins', () => {
    const unpopularCabin = { ...mockCabin, _id: '000000000000000000000005' }; // "0005" → 5 % 10 = 5 → not popular
    render(<CabinCard cabin={unpopularCabin} />);
    expect(screen.queryByText('Popular')).not.toBeInTheDocument();
  });
});
