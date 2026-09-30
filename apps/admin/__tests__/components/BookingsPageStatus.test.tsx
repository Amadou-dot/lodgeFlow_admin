import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ComponentProps } from 'react';
import type BookingsTable from '@/components/BookingsTable';
import type { BookingStatus } from '@/lib/config';

const mockRefresh = jest.fn();
const mockUpdate = jest.fn<
  Promise<void>,
  [{ _id: string; status: BookingStatus }]
>();
const mockToast = jest.fn();
let mockTargetId = '507f1f77bcf86cd799439011';
jest.mock('@/hooks/useBookings', () => ({
  useBookings: () => ({
    data: {
      bookings: [{ _id: '507f1f77bcf86cd799439011', status: 'checked-in' }],
      pagination: { totalBookings: 1, totalPages: 1 },
    },
    isLoading: false,
    error: undefined,
    mutate: mockRefresh,
  }),
  useUpdateBooking: () => ({ mutateAsync: mockUpdate }),
  useDeleteBooking: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock('@/components/BookingsTable', () => ({
  __esModule: true,
  default: ({
    onStatusChange,
  }: Pick<ComponentProps<typeof BookingsTable>, 'onStatusChange'>) => (
    <button
      onClick={() =>
        onStatusChange?.({ bookingId: mockTargetId, status: 'checked-out' })
      }
    >
      Change status
    </button>
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
jest.mock('@/hooks/useConfirmDialog', () => ({
  useConfirmDialog: () => ({
    showConfirm: jest.fn(),
    ConfirmDialog: () => null,
  }),
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
jest.mock('@heroui/toast', () => ({
  addToast: (...args: unknown[]) => mockToast(...args),
}));
import BookingsPage from '@/app/(dashboard)/bookings/page';

beforeEach(() => {
  jest.clearAllMocks();
  mockTargetId = '507f1f77bcf86cd799439011';
  mockUpdate.mockResolvedValue();
});

test('submits the same status payload and refreshes SWR only after mutation success', async () => {
  let finish: () => void = () => {
    throw new Error('Mutation not started');
  };
  mockUpdate.mockImplementation(
    () =>
      new Promise<void>(resolve => {
        finish = resolve;
      })
  );
  render(<BookingsPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Change status' }));
  expect(mockUpdate).toHaveBeenCalledWith({
    _id: mockTargetId,
    status: 'checked-out',
  });
  expect(mockRefresh).not.toHaveBeenCalled();
  await act(async () => {
    finish();
  });
  expect(mockRefresh).toHaveBeenCalledTimes(1);
  expect(mockToast).not.toHaveBeenCalled();
});
test.each([
  [new Error('Booking changed; refresh'), 'Booking changed; refresh'],
  ['unexpected failure', 'Failed to update booking status'],
])(
  'preserves failure toast and skips refresh for %p',
  async (error, message) => {
    mockUpdate.mockRejectedValueOnce(error);
    render(<BookingsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Change status' }));
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Status update failed',
        description: message,
        color: 'danger',
      })
    );
    expect(mockRefresh).not.toHaveBeenCalled();
  }
);
test('ignores an action for a booking absent from the current list', async () => {
  mockTargetId = 'missing';
  render(<BookingsPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Change status' }));
  await act(async () => {});
  expect(mockUpdate).not.toHaveBeenCalled();
  expect(mockRefresh).not.toHaveBeenCalled();
  expect(mockToast).not.toHaveBeenCalled();
});
