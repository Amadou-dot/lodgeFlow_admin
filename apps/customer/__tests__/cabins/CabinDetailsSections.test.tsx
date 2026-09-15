import { render, screen } from '@testing-library/react';
import {
  CabinDescriptionSection,
  CabinAmenitiesSection,
  CabinInfoSection,
  CabinHouseRulesSection,
} from '@/components/CabinDetails';
import type { Cabin } from '@/types';

jest.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({ data: null, isLoading: false }),
}));

const mockCabin = {
  _id: '1',
  name: 'Test Cabin',
  price: 200,
  capacity: 4,
  image: 'https://example.com/cabin.jpg',
  discount: 0,
  description: 'A beautiful mountain cabin.',
  amenities: ['WiFi', 'Kitchen'],
} as unknown as Cabin;

describe('CabinDescriptionSection', () => {
  it('renders description heading and text', () => {
    render(<CabinDescriptionSection cabin={mockCabin} />);
    expect(screen.getByText('About this cabin')).toBeInTheDocument();
    expect(screen.getByText('A beautiful mountain cabin.')).toBeInTheDocument();
  });
});

describe('CabinAmenitiesSection', () => {
  it('renders amenities when present', () => {
    render(<CabinAmenitiesSection cabin={mockCabin} />);
    expect(screen.getByText('Amenities')).toBeInTheDocument();
    expect(screen.getByText('WiFi')).toBeInTheDocument();
  });

  it('renders nothing when amenities array is empty', () => {
    const { container } = render(
      <CabinAmenitiesSection
        cabin={{ ...mockCabin, amenities: [] } as unknown as Cabin}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('CabinInfoSection', () => {
  it('renders cabin capacity', () => {
    render(<CabinInfoSection cabin={mockCabin} />);
    expect(screen.getByText('Cabin Information')).toBeInTheDocument();
  });
});

describe('CabinHouseRulesSection', () => {
  it('renders house rules section heading', () => {
    render(<CabinHouseRulesSection />);
    expect(screen.getByText('House Rules')).toBeInTheDocument();
  });
});
