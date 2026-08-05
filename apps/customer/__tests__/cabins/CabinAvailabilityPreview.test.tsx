import { render, screen } from '@testing-library/react';
import CabinAvailabilityPreview from '@/components/CabinAvailabilityPreview';
import { useCabinAvailability } from '@/hooks/useCabinAvailability';

jest.mock('@/hooks/useCabinAvailability');

describe('CabinAvailabilityPreview', () => {
  it('renders skeleton while loading', () => {
    (useCabinAvailability as jest.Mock).mockReturnValue({
      isLoading: true,
      data: null,
    });
    const { container } = render(<CabinAvailabilityPreview cabinId='abc' />);
    expect(
      container.querySelector('[data-testid="availability-skeleton"]')
    ).toBeInTheDocument();
  });

  it('renders month headings when loaded', () => {
    (useCabinAvailability as jest.Mock).mockReturnValue({
      isLoading: false,
      data: {
        unavailableDates: [],
        queryRange: { start: '2026-03-01', end: '2026-09-01' },
      },
    });
    render(<CabinAvailabilityPreview cabinId='abc' />);
    expect(screen.getByText('Availability')).toBeInTheDocument();
  });

  it('renders Available and Booked legend items', () => {
    (useCabinAvailability as jest.Mock).mockReturnValue({
      isLoading: false,
      data: {
        unavailableDates: [],
        queryRange: { start: '2026-03-01', end: '2026-09-01' },
      },
    });
    render(<CabinAvailabilityPreview cabinId='abc' />);
    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.getByText('Booked')).toBeInTheDocument();
  });

  it('renders error message when fetch fails', () => {
    (useCabinAvailability as jest.Mock).mockReturnValue({
      isLoading: false,
      isError: true,
      error: new Error('Network error'),
      data: undefined,
    });
    render(<CabinAvailabilityPreview cabinId='abc' />);
    expect(
      screen.getByText(/unable to load availability/i)
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-testid="availability-skeleton"]')
    ).not.toBeInTheDocument();
  });

  it('marks unavailable dates with danger styling', () => {
    // Pick dates a few days into the future to avoid the component skipping past days.
    const toIso = (d: Date) => d.toISOString().slice(0, 10);
    const startDateObj = new Date();
    startDateObj.setDate(startDateObj.getDate() + 3);
    const endDateObj = new Date();
    endDateObj.setDate(endDateObj.getDate() + 5);
    const startDate = toIso(startDateObj);
    const endDate = toIso(endDateObj);

    (useCabinAvailability as jest.Mock).mockReturnValue({
      isLoading: false,
      data: {
        unavailableDates: [{ start: startDate, end: endDate }],
        queryRange: { start: '2026-03-01', end: '2026-09-01' },
      },
    });
    const { container } = render(<CabinAvailabilityPreview cabinId='abc' />);
    // Find all day cells in the calendar
    const dayCells = container.querySelectorAll(
      '.rounded.py-0\\.5.text-center.text-xs'
    );
    const dangerCells = Array.from(dayCells).filter(cell =>
      cell.className.includes('bg-danger-100')
    );
    expect(dangerCells.length).toBeGreaterThan(0);
  });

  it('handles December-to-January year rollover', () => {
    const RealDate = global.Date;
    const mockDate = new RealDate(2026, 11, 15); // December 2026
    jest.spyOn(global, 'Date').mockImplementation((...args: unknown[]) => {
      if (args.length === 0) return mockDate;
      // @ts-expect-error -- calling Date constructor with spread args
      return new RealDate(...args);
    });

    (useCabinAvailability as jest.Mock).mockReturnValue({
      isLoading: false,
      data: {
        unavailableDates: [],
        queryRange: { start: '2026-12-01', end: '2027-02-01' },
      },
    });
    render(<CabinAvailabilityPreview cabinId='abc' />);
    expect(screen.getByText('December 2026')).toBeInTheDocument();
    expect(screen.getByText('January 2027')).toBeInTheDocument();

    jest.restoreAllMocks();
  });
});
