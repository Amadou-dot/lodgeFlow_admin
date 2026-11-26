import BookingEditPage from '@/app/(dashboard)/bookings/[id]/edit/page';
import type { UpdateBookingInput } from '@/types/api';
import type { AdminBooking } from '@/types/booking-read';
import type { Cabin, Customer } from '@/types';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const cabin: Cabin = {
  _id: '507f1f77bcf86cd799439011',
  id: '507f1f77bcf86cd799439011',
  name: 'Pine Cabin',
  image: 'https://example.com/pine.jpg',
  images: [],
  capacity: 4,
  price: 200,
  discount: 0,
  description: 'Quiet cabin',
  amenities: [],
  status: 'active',
};
const savedCustomer = {
  id: 'user_saved',
  name: 'Saved Guest',
  email: 'saved@example.com',
};
const otherCustomer: Customer = {
  id: 'user_other',
  name: 'Other Guest',
  email: 'other@example.com',
  username: null,
  first_name: 'Other',
  last_name: 'Guest',
  image_url: '',
  has_image: false,
  created_at: '2030-01-01T00:00:00.000Z',
  updated_at: '2030-01-01T00:00:00.000Z',
  last_sign_in_at: null,
  last_active_at: '2030-01-01T00:00:00.000Z',
  banned: false,
  locked: false,
  lockout_expires_in_seconds: null,
  totalBookings: 0,
  totalSpent: 0,
  loyaltyTier: 'Bronze',
};
const firstBooking: AdminBooking = {
  _id: '507f1f77bcf86cd799439012',
  id: '507f1f77bcf86cd799439012',
  cabin,
  customer: savedCustomer,
  guest: savedCustomer,
  status: 'confirmed',
  checkInDate: '2040-01-07T12:34:56.789Z',
  checkOutDate: '2040-01-10T13:57:24.680Z',
  numNights: 3,
  numGuests: 2,
  cabinPrice: 200,
  extrasPrice: 0,
  totalPrice: 600,
  depositAmount: 150,
  isPaid: true,
  amountPaid: 600,
  depositPaid: true,
  remainingAmount: 0,
  paymentMethod: 'cash',
  observations: 'Saved observations',
  specialRequests: ['Extra blankets'],
};

let mockBooking: AdminBooking | undefined;
let mockIsLoading: boolean;
let mockError: Error | undefined;
let mockCustomers: Customer[];
const mockUpdate = jest.fn<Promise<void>, [UpdateBookingInput]>();
const mockSearchCustomers = jest.fn<Promise<void>, [string]>();

jest.mock('react', () => ({
  ...jest.requireActual<typeof import('react')>('react'),
  // The test uses React 18 outside the App Router's promise unwrap.
  use: (params: Promise<{ id: string }> & { value: { id: string } }) =>
    params.value,
}));
jest.mock('@heroui/date-picker', () => ({ DateRangePicker: () => null }));
jest.mock('@/hooks/useBookings', () => ({
  useBooking: () => ({
    data: mockBooking,
    isLoading: mockIsLoading,
    error: mockError,
  }),
  useUpdateBooking: () => ({ mutateAsync: mockUpdate, isPending: false }),
}));
jest.mock('@/hooks/useCabins', () => ({
  useCabins: () => ({ data: [cabin] }),
}));
jest.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({ data: undefined }),
}));
jest.mock('@/hooks/useInfiniteCustomers', () => ({
  useInfiniteCustomers: () => ({
    customers: mockCustomers,
    hasMore: false,
    isLoading: false,
    onLoadMore: jest.fn(),
    searchCustomers: mockSearchCustomers,
  }),
}));

function route(id: string) {
  const value = { id };
  return Object.assign(Promise.resolve(value), { value });
}

beforeEach(() => {
  mockBooking = undefined;
  mockIsLoading = true;
  mockError = undefined;
  mockCustomers = [otherCustomer];
  mockUpdate.mockReset().mockResolvedValue(undefined);
  mockSearchCustomers.mockReset().mockResolvedValue(undefined);
});

test.each(['confirmed', 'unconfirmed'] as const)(
  'initializes %s booking fields when a cold detail request resolves',
  status => {
    const params = route(firstBooking._id);
    const { rerender } = render(<BookingEditPage params={params} />);
    expect(screen.queryByRole('button', { name: 'Update Booking' })).toBeNull();

    mockBooking = { ...firstBooking, status };
    mockIsLoading = false;
    rerender(<BookingEditPage params={params} />);

    expect(screen.getByRole('combobox', { name: 'Select Cabin' })).toHaveValue(
      'Pine Cabin'
    );
    expect(
      screen.getByRole('spinbutton', { name: 'Number of Guests' })
    ).toHaveValue(2);
    expect(screen.getByText('Duration: 3 nights')).toBeInTheDocument();
    expect(screen.getByText('Extra blankets')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Observations' })).toHaveValue(
      'Saved observations'
    );
  }
);

test('saves a notes-only draft for a known guest outside the first page and keeps the original stay baseline after revalidation', async () => {
  const user = userEvent.setup();
  mockBooking = firstBooking;
  mockIsLoading = false;
  const params = route(firstBooking._id);
  const { rerender } = render(<BookingEditPage params={params} />);
  const customer = screen.getByRole('combobox', { name: 'Select Customer' });
  const userRequest = screen.getByPlaceholderText('Add a special request');
  await user.type(userRequest, 'Extra towels');
  await user.click(screen.getByRole('button', { name: 'Add' }));

  mockIsLoading = true;
  rerender(<BookingEditPage params={params} />);
  expect(customer).toBeInTheDocument();

  mockIsLoading = false;
  mockError = new Error('Failed to fetch booking');
  rerender(<BookingEditPage params={params} />);
  expect(screen.getByText('Failed to load booking data.')).toBeInTheDocument();
  expect(customer).not.toBeInTheDocument();

  mockError = undefined;
  mockBooking = {
    ...firstBooking,
    checkOutDate: '2040-01-11T13:57:24.680Z',
    numNights: 4,
    specialRequests: ['Server version'],
  };
  rerender(<BookingEditPage params={params} />);

  expect(screen.getByRole('combobox', { name: 'Select Customer' })).toHaveValue(
    'Saved Guest'
  );
  expect(screen.getByText('Duration: 3 nights')).toBeInTheDocument();
  expect(screen.getByText('Extra towels')).toBeInTheDocument();
  expect(screen.queryByText('Server version')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Update Booking' }));
  await waitFor(() =>
    expect(mockUpdate).toHaveBeenCalledWith({
      _id: firstBooking._id,
      cabin: cabin._id,
      customer: savedCustomer.id,
      status: 'confirmed',
      numGuests: 2,
      paymentMethod: 'cash',
      observations: 'Saved observations',
      specialRequests: ['Extra blankets', 'Extra towels'],
      extras: {
        hasBreakfast: false,
        hasPets: false,
        hasParking: false,
        hasEarlyCheckIn: false,
        hasLateCheckOut: false,
      },
    })
  );
});

test('omits the untouched legacy stay pair from a notes-only update', async () => {
  const user = userEvent.setup();
  mockBooking = firstBooking;
  mockIsLoading = false;
  mockCustomers = [{ ...otherCustomer, ...savedCustomer }];
  render(<BookingEditPage params={route(firstBooking._id)} />);

  await user.type(
    screen.getByPlaceholderText('Add a special request'),
    'Extra towels'
  );
  await user.click(screen.getByRole('button', { name: 'Add' }));
  await user.click(screen.getByRole('button', { name: 'Update Booking' }));

  expect(mockUpdate).toHaveBeenCalledTimes(1);
  const body = mockUpdate.mock.calls[0][0];
  expect(body.specialRequests).toEqual(['Extra blankets', 'Extra towels']);
  expect(body).not.toHaveProperty('checkInDate');
  expect(body).not.toHaveProperty('checkOutDate');
});

test('discards the prior record draft and mounts only the matching detail after a route change', async () => {
  const user = userEvent.setup();
  mockBooking = firstBooking;
  mockIsLoading = false;
  const { rerender } = render(
    <BookingEditPage params={route(firstBooking._id)} />
  );
  const observations = screen.getByRole('textbox', { name: 'Observations' });
  await user.clear(observations);
  await user.type(observations, 'First draft');
  const nextId = '507f1f77bcf86cd799439013';
  const params = route(nextId);
  rerender(<BookingEditPage params={params} />);
  expect(screen.queryByRole('button', { name: 'Update Booking' })).toBeNull();

  mockBooking = {
    ...firstBooking,
    _id: nextId,
    id: nextId,
    customer: otherCustomer,
    guest: otherCustomer,
    status: 'unconfirmed',
    numGuests: 3,
    observations: 'Second booking',
    specialRequests: [],
  };
  rerender(<BookingEditPage params={params} />);
  expect(screen.getByRole('textbox', { name: 'Observations' })).toHaveValue(
    'Second booking'
  );
  expect(screen.getByRole('combobox', { name: 'Select Customer' })).toHaveValue(
    'Other Guest'
  );

  await user.click(screen.getByRole('button', { name: 'Update Booking' }));
  await waitFor(() =>
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: nextId,
        customer: otherCustomer.id,
        status: 'unconfirmed',
        numGuests: 3,
      })
    )
  );

  mockBooking = firstBooking;
  rerender(<BookingEditPage params={route(firstBooking._id)} />);
  expect(screen.getByRole('textbox', { name: 'Observations' })).toHaveValue(
    'Saved observations'
  );
});

test('keeps a missing guest explicit and requires an intentional replacement', async () => {
  const user = userEvent.setup();
  mockBooking = { ...firstBooking, customer: null, guest: null };
  mockIsLoading = false;
  render(<BookingEditPage params={route(firstBooking._id)} />);
  expect(
    screen.getByText('Update booking details for Unknown Guest')
  ).toBeInTheDocument();
  const customer = screen.getByRole('combobox', { name: 'Select Customer' });
  expect(customer).toHaveValue('');
  await user.click(screen.getByRole('button', { name: 'Update Booking' }));
  expect(mockUpdate).not.toHaveBeenCalled();

  await user.type(customer, 'Other');
  await user.click(await screen.findByRole('option', { name: /Other Guest/ }));
  expect(customer).toHaveValue('Other Guest');
  await user.click(screen.getByRole('button', { name: 'Update Booking' }));
  await waitFor(() =>
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: otherCustomer.id })
    )
  );
});

test('keeps a replacement selected outside later results and clears it through the customer control', async () => {
  const user = userEvent.setup();
  mockBooking = firstBooking;
  mockIsLoading = false;
  const params = route(firstBooking._id);
  const { rerender } = render(<BookingEditPage params={params} />);
  const customer = screen.getByRole('combobox', { name: 'Select Customer' });

  await user.clear(customer);
  await user.type(customer, 'Other');
  await waitFor(() =>
    expect(mockSearchCustomers).toHaveBeenCalledWith('Other')
  );
  await user.click(await screen.findByRole('option', { name: /Other Guest/ }));
  expect(customer).toHaveValue('Other Guest');

  mockCustomers = [];
  rerender(<BookingEditPage params={params} />);
  await user.tab();
  expect(customer).toHaveValue('Other Guest');

  mockError = new Error('Failed to fetch booking');
  rerender(<BookingEditPage params={params} />);
  expect(customer).not.toBeInTheDocument();
  mockError = undefined;
  rerender(<BookingEditPage params={params} />);
  const recoveredCustomer = screen.getByRole('combobox', {
    name: 'Select Customer',
  });
  expect(recoveredCustomer).toHaveValue('Other Guest');

  await user.click(screen.getByRole('button', { name: 'Update Booking' }));
  await waitFor(() =>
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: otherCustomer.id })
    )
  );
  mockUpdate.mockClear();

  await user.click(screen.getByRole('button', { name: 'Clear customer' }));
  expect(recoveredCustomer).toHaveValue('');
  await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button', { name: 'Update Booking' }));
  expect(mockUpdate).not.toHaveBeenCalled();
});

test('recognizes a valid uppercase route ID for the resolved booking', () => {
  mockBooking = firstBooking;
  mockIsLoading = false;
  render(<BookingEditPage params={route(firstBooking._id.toUpperCase())} />);

  expect(
    screen.getByRole('button', { name: 'Update Booking' })
  ).toBeInTheDocument();
});
