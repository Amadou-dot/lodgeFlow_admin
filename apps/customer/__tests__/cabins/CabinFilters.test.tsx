import { render, screen } from '@/__tests__/shared/test-utils';
import CabinFilters from '@/components/CabinFilters';

describe('CabinFilters', () => {
  const mockOnFiltersChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders cabin filters component', () => {
    render(<CabinFilters onFiltersChange={mockOnFiltersChange} />);

    // Component should render successfully - look for specific element
    expect(screen.getAllByText(/capacity/i)[0]).toBeInTheDocument();
  });

  it('renders filter controls', () => {
    render(<CabinFilters onFiltersChange={mockOnFiltersChange} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('accepts isLoading prop', () => {
    const { rerender } = render(
      <CabinFilters isLoading={false} onFiltersChange={mockOnFiltersChange} />
    );

    // Should render without error
    expect(screen.getAllByText(/capacity/i)[0]).toBeInTheDocument();

    // Rerender with loading state
    rerender(
      <CabinFilters isLoading={true} onFiltersChange={mockOnFiltersChange} />
    );

    // Should still render
    expect(screen.getAllByText(/capacity/i)[0]).toBeInTheDocument();
  });
});
