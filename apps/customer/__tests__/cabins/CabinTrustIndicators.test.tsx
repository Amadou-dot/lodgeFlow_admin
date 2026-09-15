import { render, screen } from '@testing-library/react';
import CabinTrustIndicators from '@/components/CabinTrustIndicators';
import type { CancellationPolicy } from '@/types';

describe('CabinTrustIndicators', () => {
  it('renders all 4 trust indicators', () => {
    render(<CabinTrustIndicators cancellationPolicy='flexible' />);
    expect(screen.getByText('Secure Booking')).toBeInTheDocument();
    expect(screen.getByText('Verified Host')).toBeInTheDocument();
    expect(screen.getByText('24/7 Support')).toBeInTheDocument();
    expect(screen.getByText('Cancellation Policy')).toBeInTheDocument();
  });

  it.each([
    ['flexible', 'Free cancellation up to 24 hours before check-in'],
    ['moderate', 'Free cancellation up to 5 days before check-in'],
    ['strict', '50% refund up to 7 days before check-in'],
  ] as [CancellationPolicy, string][])(
    'shows correct cancellation text for %s policy',
    (policy, expectedText) => {
      render(<CabinTrustIndicators cancellationPolicy={policy} />);
      expect(screen.getByText(expectedText)).toBeInTheDocument();
    }
  );
});
