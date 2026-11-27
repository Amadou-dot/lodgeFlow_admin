/** @jest-environment ./__tests__/setup/fetch-jsdom.cjs */
import GuestDetailPage from '@/app/(dashboard)/guests/[id]/page';
import type { CustomerWithStats } from '@/types';
import type { CustomerResponse } from '@/types/customer-responses';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { customerJsonFixture } from '../setup/customer-json';

jest.unmock('swr');
jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'user_guest' }),
  useRouter: () => ({ push: jest.fn() }),
}));

const customer: CustomerWithStats = {
  ...customerJsonFixture,
  name: 'Test Guest',
  email: 'guest@example.invalid',
  totalBookings: 1,
  totalSpent: 400,
  completedBookings: 0,
  totalRevenue: 0,
  averageStayLength: 0,
  loyaltyTier: 'Bronze',
  recentBookings: [
    {
      _id: '507f1f77bcf86cd799439011',
      id: '507f1f77bcf86cd799439011',
      customer: customerJsonFixture.id,
      cabin: {
        _id: '507f1f77bcf86cd799439012',
        id: '507f1f77bcf86cd799439012',
        name: 'Pine Cabin',
        image: 'https://example.invalid/pine.jpg',
        capacity: 4,
        price: 200,
      },
      checkInDate: '2027-01-01T00:00:00.000Z',
      checkOutDate: '2027-01-03T00:00:00.000Z',
      numNights: 2,
      numGuests: 2,
      status: 'confirmed',
      cabinPrice: 400,
      extrasPrice: 0,
      totalPrice: 400,
      isPaid: false,
      amountPaid: 0,
      depositPaid: false,
      depositAmount: 0,
      remainingAmount: 400,
    },
  ],
};

test('guest history lists the UTC stay dates in both the table and mobile card', async () => {
  const payload = { success: true, data: customer } satisfies CustomerResponse;
  jest.mocked(fetch).mockResolvedValueOnce(Response.json(payload));

  render(
    <QueryClientProvider client={new QueryClient()}>
      <SWRConfig
        value={{ provider: () => new Map(), shouldRetryOnError: false }}
      >
        <GuestDetailPage />
      </SWRConfig>
    </QueryClientProvider>
  );

  const table = await screen.findByRole('grid', { name: 'Recent bookings' });
  expect(within(table).getByText('Jan 1, 2027')).toBeInTheDocument();
  expect(within(table).getByText('to Jan 3, 2027')).toBeInTheDocument();
  expect(screen.getAllByText('Jan 1, 2027')).toHaveLength(2);
  expect(screen.getAllByText('to Jan 3, 2027')).toHaveLength(2);
});
