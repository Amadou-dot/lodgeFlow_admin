import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ComponentProps } from 'react';
import type BookingsTable from '@/components/BookingsTable';
import type { PopulatedBooking } from '@/types';
const mockBooking: PopulatedBooking = {
  _id: 'booking',
  id: 'booking',
  guest: null,
  cabin: null,
  customer: null,
  checkInDate: '2040-01-01',
  checkOutDate: '2040-01-02',
  numNights: 1,
  numGuests: 1,
  status: 'confirmed',
  cabinPrice: 10,
  extrasPrice: 0,
  totalPrice: 10,
  depositAmount: 0,
  amountPaid: 0,
  remainingAmount: 10,
  isPaid: false,
  depositPaid: false,
};
const mockDelete = jest.fn<Promise<void>, [string]>();
const mockRefresh = jest.fn();
jest.mock('@/hooks/useBookings', () => ({
  useBookings: () => ({
    data: {
      bookings: [mockBooking],
      pagination: { totalBookings: 1, totalPages: 1 },
    },
    isLoading: false,
    mutate: mockRefresh,
  }),
  useDeleteBooking: () => ({ mutateAsync: mockDelete, isPending: false }),
  useUpdateBooking: () => ({}),
}));
jest.mock('@/components/BookingsTable', () => ({
  __esModule: true,
  default: ({ onDelete }: ComponentProps<typeof BookingsTable>) => (
    <button onClick={() => onDelete?.(mockBooking)}>Delete row</button>
  ),
}));
jest.mock('@/components/BookingStats', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/BookingsFilters', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/hooks/useDetailPageMemory', () => ({
  clearDetailMemory: jest.fn(),
}));
jest.mock('@/hooks/useURLFilters', () => ({
  bookingsFilterConfig: {},
  useURLFilters: () => ({
    filters: {},
    updateFilter: jest.fn(),
    updateFilters: jest.fn(),
    resetFilters: jest.fn(),
  }),
}));
import BookingsPage from '@/app/(dashboard)/bookings/page';
beforeEach(() => {
  jest.clearAllMocks();
  mockDelete.mockResolvedValue(undefined);
});
test('failed deletion remains open for retry and refreshes the list only after success', async () => {
  mockDelete.mockRejectedValueOnce(new Error('Active booking'));
  render(<BookingsPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Delete row' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Active booking');
  expect(mockRefresh).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
  expect(mockDelete).toHaveBeenNthCalledWith(1, 'booking');
  expect(mockDelete).toHaveBeenNthCalledWith(2, 'booking');
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  );
});
test('confirmation owns pending and prevents a duplicate delete before list refresh', async () => {
  let finish: () => void = () => {
    throw new Error('not started');
  };
  mockDelete.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      })
  );
  render(<BookingsPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Delete row' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
  const pending = await screen.findByRole('button', { name: /Processing/ });
  expect(pending).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  fireEvent.click(pending);
  expect(mockDelete).toHaveBeenCalledTimes(1);
  expect(mockRefresh).not.toHaveBeenCalled();
  await act(async () => {
    finish();
  });
  expect(mockRefresh).toHaveBeenCalledTimes(1);
});
