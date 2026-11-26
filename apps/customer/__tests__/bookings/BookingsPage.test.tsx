import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { addToast } from '@heroui/toast';
import type * as bookingHooks from '@/hooks/useBooking';
import { FetchResponse } from '@/__tests__/shared/checkout-failure-fixtures';
import type { BookingHistoryItem } from '@/types/booking-read';
import BookingsPage from '@/app/bookings/page';
import { mockBrowserTimeZone } from '@/__tests__/shared/browser-time-zone';

jest.mock('@heroui/toast', () => ({ addToast: jest.fn() }));
const mockCancelBooking = jest.fn();
const mockCancelDining = jest.fn();
const mockCancelExperience = jest.fn();
let mockReservation: 'dining' | 'experience' | undefined;
const mockReservationFields = {
  _id: '507f1f77bcf86cd799439021',
  customer: 'user_customer',
  date: '2030-01-01T00:00:00.000Z',
  totalPrice: 12,
  status: 'confirmed',
  isPaid: true,
};
const mockUpdateBooking = jest.fn();
type UpdateHook = (
  id: string | undefined
) => Pick<
  ReturnType<typeof bookingHooks.useUpdateBooking>,
  'mutateAsync' | 'isPending'
>;
type CancelHook = (
  id: string | undefined
) => Pick<
  ReturnType<typeof bookingHooks.useCancelBooking>,
  'mutateAsync' | 'isPending'
>;
const mockUpdateHook = jest.fn<
  ReturnType<UpdateHook>,
  Parameters<UpdateHook>
>();
const mockCancelHook = jest.fn<
  ReturnType<CancelHook>,
  Parameters<CancelHook>
>();
let mockBookings: BookingHistoryItem[];
let mockAuth = {
  isLoaded: true,
  isSignedIn: true,
  userId: 'user_customer',
  sessionId: 'session-one',
};
jest.mock('@clerk/nextjs', () => ({
  useAuth: () => mockAuth,
  SignInButton: ({ children }: { children: React.ReactNode }) => children,
}));

const mockBooking: BookingHistoryItem = {
  _id: '507f1f77bcf86cd799439011',
  customer: 'user_customer',
  checkInDate: '2030-01-01T00:00:00.000Z',
  checkOutDate: '2030-01-03T00:00:00.000Z',
  numNights: 2,
  numGuests: 2,
  status: 'unconfirmed',
  cabinPrice: 200,
  totalPrice: 200,
  cabin: {
    _id: '507f1f77bcf86cd799439012',
    name: 'Pine',
    image: 'https://example.com/pine.jpg',
    images: [],
    capacity: 4,
    price: 100,
    discount: 0,
    description: 'Forest cabin',
    status: 'active',
  },
};

jest.mock('@heroui/button', () => ({
  Button: ({
    children,
    onPress,
  }: {
    children: React.ReactNode;
    onPress?: () => void;
  }) => <button onClick={onPress}>{children}</button>,
}));
jest.mock('@heroui/modal', () => {
  const { useState } = jest.requireActual<typeof import('react')>('react');
  const Container = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Modal: ({
      isOpen,
      children,
    }: {
      isOpen: boolean;
      children: React.ReactNode;
    }) => (isOpen ? <div>{children}</div> : null),
    ModalContent: ({
      children,
    }: {
      children: (close: () => void) => React.ReactNode;
    }) => <div>{children(() => {})}</div>,
    ModalHeader: Container,
    ModalBody: Container,
    ModalFooter: Container,
    useDisclosure: () => {
      const [isOpen, setOpen] = useState(false);
      return {
        isOpen,
        onOpen: () => setOpen(true),
        onClose: () => setOpen(false),
      };
    },
  };
});
jest.mock('@heroui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tab: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock('@/hooks/useBooking', () => ({
  useBookingHistory: () => ({
    data: mockBookings,
    isLoading: false,
    error: null,
  }),
  useCancelBooking: (id: string | undefined) => mockCancelHook(id),
  useUpdateBooking: (id: string | undefined) => mockUpdateHook(id),
}));
jest.mock('@/hooks/useDiningReservation', () => ({
  useDiningReservationHistory: () => ({
    data:
      mockReservation === 'dining'
        ? [
            {
              ...mockReservationFields,
              dining: null,
              time: '18:00',
              numGuests: 2,
            },
          ]
        : [],
    isLoading: false,
    error: null,
  }),
  useCancelDiningReservation: () => ({ mutateAsync: mockCancelDining }),
}));
jest.mock('@/hooks/useExperienceBooking', () => ({
  useExperienceBookingHistory: () => ({
    data:
      mockReservation === 'experience'
        ? [{ ...mockReservationFields, experience: null, numParticipants: 2 }]
        : [],
    isLoading: false,
    error: null,
  }),
  useCancelExperienceBooking: () => ({ mutateAsync: mockCancelExperience }),
}));
jest.mock('@/components/PaymentButton', () => ({
  __esModule: true,
  default: () => <button>Pay</button>,
}));
jest.mock('@heroui/date-picker', () => ({ DatePicker: () => <div /> }));

beforeEach(() => {
  mockAuth = {
    isLoaded: true,
    isSignedIn: true,
    userId: 'user_customer',
    sessionId: 'session-one',
  };
  mockUpdateHook.mockImplementation(() => ({
    mutateAsync: mockUpdateBooking,
    isPending: false,
  }));
  mockCancelHook.mockImplementation(() => ({
    mutateAsync: mockCancelBooking,
    isPending: false,
  }));
  mockReservation = undefined;
  mockCancelBooking.mockReset();
  mockCancelDining.mockReset();
  mockCancelExperience.mockReset();
  mockUpdateBooking.mockReset();
  mockBookings = [mockBooking];
});
afterEach(() => jest.restoreAllMocks());

describe('booking history JSON in the bookings page', () => {
  it('hides history and the open dialog on sign-out and a signed-out remount', () => {
    const view = render(<BookingsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'View Details' }));
    expect(screen.getByText('January 1, 2030')).toBeInTheDocument();
    mockAuth = { isLoaded: true, isSignedIn: false, userId: '', sessionId: '' };
    view.rerender(<BookingsPage />);
    expect(screen.queryByText('Pine')).not.toBeInTheDocument();
    expect(screen.queryByText('January 1, 2030')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /sign in/i })
    ).toBeInTheDocument();
    view.unmount();
    render(<BookingsPage />);
    expect(screen.queryByText('Pine')).not.toBeInTheDocument();
  });

  it.each(['account', 'session'])(
    'discards retained details when the %s changes',
    change => {
      const view = render(<BookingsPage />);
      fireEvent.click(screen.getByRole('button', { name: 'View Details' }));
      mockBookings = [];
      mockAuth = {
        ...mockAuth,
        userId: change === 'account' ? 'another-customer' : 'user_customer',
        sessionId: 'session-two',
      };
      view.rerender(<BookingsPage />);
      expect(screen.queryByText('January 1, 2030')).not.toBeInTheDocument();
      expect(screen.queryByText('Pine')).not.toBeInTheDocument();
    }
  );

  it('hides retained history while authentication is unresolved', () => {
    const view = render(<BookingsPage />);
    mockAuth = { ...mockAuth, isLoaded: false };
    view.rerender(<BookingsPage />);
    expect(screen.queryByText('Pine')).not.toBeInTheDocument();
  });

  it.each(['resolve', 'reject'] as const)(
    'an old account edit that later %ss cannot replace the new account dialog',
    async outcome => {
      let complete = () => {};
      mockUpdateBooking.mockImplementationOnce(
        () =>
          new Promise((resolve, reject) => {
            complete = () =>
              outcome === 'resolve'
                ? resolve({ success: true })
                : reject(new Error('Old edit failed'));
          })
      );
      const view = render(<BookingsPage />);
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
      fireEvent.change(screen.getByRole('spinbutton'), {
        target: { value: '3' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Update Booking' }));
      expect(mockUpdateBooking).toHaveBeenCalledTimes(1);

      mockAuth = { ...mockAuth, userId: 'bob', sessionId: 'bob-session' };
      mockBookings = [
        {
          ...mockBooking,
          _id: '507f1f77bcf86cd799439099',
          customer: 'bob',
          numGuests: 4,
        },
      ];
      view.rerender(<BookingsPage />);
      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
      fireEvent.change(screen.getByRole('spinbutton'), {
        target: { value: '1' },
      });
      jest.mocked(addToast).mockClear();
      await act(async () => complete());
      expect(addToast).not.toHaveBeenCalled();
      expect(screen.getByRole('spinbutton')).toHaveValue(1);
      expect(
        screen.getByRole('button', { name: 'Update Booking' })
      ).toBeInTheDocument();
      expect(mockUpdateBooking).toHaveBeenCalledTimes(1);
    }
  );

  it.each(['America/Denver', 'Asia/Tokyo'])(
    'preserves stay dates in the %s history and details',
    zone => {
      mockBrowserTimeZone(zone);
      render(<BookingsPage />);
      expect(
        screen.getByText('January 1, 2030 - January 3, 2030')
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'View Details' }));
      expect(screen.getByText('January 1, 2030')).toBeInTheDocument();
      expect(screen.getByText('January 3, 2030')).toBeInTheDocument();
    }
  );

  it('keeps cancellation timestamps in the browser local zone', () => {
    mockBrowserTimeZone('America/Denver');
    const previous = {
      status: mockBooking.status,
      cancelledAt: mockBooking.cancelledAt,
    };
    mockBooking.status = 'cancelled';
    mockBooking.cancelledAt = '2030-01-01T01:00:00.000Z';
    try {
      render(<BookingsPage />);
      expect(
        screen.getByText('Cancelled on December 31, 2029')
      ).toBeInTheDocument();
    } finally {
      Object.assign(mockBooking, previous);
    }
  });

  it('only offers supported guest edits and submits no ignored dates or notes', async () => {
    mockUpdateBooking.mockResolvedValue({ success: true });
    const { container } = render(<BookingsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(await screen.findByRole('spinbutton'), {
      target: { value: '3' },
    });
    expect(container.querySelector('input[type="date"]')).toBeNull();
    expect(
      screen.queryByPlaceholderText('Any special requests or notes...')
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Update Booking' }));
    await waitFor(() =>
      expect(mockUpdateBooking).toHaveBeenCalledWith({
        bookingId: mockBooking._id,
        updates: { numGuests: 3 },
      })
    );
  });
  it('uses the persisted cabin capacity when editing a booking', async () => {
    render(<BookingsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(await screen.findByRole('spinbutton')).toHaveAttribute('max', '4');
    expect(
      screen.getByText(/Maximum capacity:.*4.*guests/)
    ).toBeInTheDocument();
  });

  it('renders a booking whose populated cabin no longer exists', () => {
    const cabin = mockBooking.cabin;
    mockBooking.cabin = null;
    try {
      render(<BookingsPage />);
      expect(screen.getByRole('img', { name: 'Cabin' })).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Pay' })
      ).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'View Details' }));
      expect(screen.getByText('Booking Details')).toBeInTheDocument();
    } finally {
      mockBooking.cabin = cabin;
    }
  });
});

it('details follow refreshed query records rather than the originally selected object', () => {
  const view = render(<BookingsPage />);
  fireEvent.click(screen.getByRole('button', { name: 'View Details' }));
  mockBookings = [{ ...mockBooking, numGuests: 4 }];
  view.rerender(<BookingsPage />);
  expect(screen.getByText('2 nights • 4 guests')).toBeInTheDocument();
});
it('opening another workflow replaces the previous dialog', () => {
  render(<BookingsPage />);
  fireEvent.click(screen.getByRole('button', { name: 'View Details' }));
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  expect(screen.queryByText('Booking Details')).not.toBeInTheDocument();
  expect(screen.getByRole('spinbutton')).toBeInTheDocument();
});
it('an older update completion does not close a newer details dialog', async () => {
  let finish: (value: unknown) => void = () => {};
  mockUpdateBooking.mockReturnValue(
    new Promise(resolve => {
      finish = resolve;
    })
  );
  render(<BookingsPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  fireEvent.click(screen.getByRole('button', { name: 'Update Booking' }));
  fireEvent.click(screen.getByRole('button', { name: 'View Details' }));
  await act(async () => finish({ success: true }));
  await waitFor(() =>
    expect(screen.getByText('Booking Details')).toBeInTheDocument()
  );
  expect(screen.getByText('January 1, 2030')).toBeInTheDocument();
});
it('preserves draft changes made while an update is pending', async () => {
  let finish: (value: unknown) => void = () => {};
  mockUpdateBooking.mockReturnValue(
    new Promise(resolve => {
      finish = resolve;
    })
  );
  render(<BookingsPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  fireEvent.click(screen.getByRole('button', { name: 'Update Booking' }));
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '3' } });
  await act(async () => finish({ success: true }));
  await waitFor(() => expect(screen.getByRole('spinbutton')).toHaveValue(3));
});
it('preserves selected context and draft when the filtered query no longer contains it', () => {
  const view = render(<BookingsPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '3' } });
  mockBookings = [];
  view.rerender(<BookingsPage />);
  expect(screen.getByRole('spinbutton')).toHaveValue(3);
  expect(
    screen.getByText(/Update the number of guests for Pine/)
  ).toBeInTheDocument();
});

it.each(['Edit', 'Cancel'] as const)(
  'rechecks the current row before submitting %s',
  action => {
    const view = render(<BookingsPage />);
    fireEvent.click(screen.getByRole('button', { name: action }));
    mockBookings = [
      { ...mockBooking, status: action === 'Edit' ? null : undefined },
    ];
    view.rerender(<BookingsPage />);
    fireEvent.click(
      screen.getByRole('button', {
        name: action === 'Edit' ? 'Update Booking' : 'Cancel Booking',
      })
    );
    expect(mockUpdateBooking).not.toHaveBeenCalled();
    expect(mockCancelBooking).not.toHaveBeenCalled();
  }
);

it('shows unknown history and detail status without offering booking actions', () => {
  mockBookings = [{ ...mockBooking, status: null }];
  render(<BookingsPage />);
  expect(
    screen.queryByRole('button', { name: /^(Pay|Edit|Cancel)$/ })
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'View Details' }));
  expect(screen.getAllByText(/unknown/i)).toHaveLength(2);
});

it('keeps a valid sparse booking payable in history', () => {
  render(<BookingsPage />);
  expect(screen.getByRole('button', { name: 'Pay' })).toBeInTheDocument();
});

it.each(['Edit', 'Cancel'] as const)(
  'keeps the %s dialog open after an unreadable write acknowledgement',
  async action => {
    const actual =
      jest.requireActual<typeof bookingHooks>('@/hooks/useBooking');
    mockUpdateHook.mockImplementation(actual.useUpdateBooking);
    mockCancelHook.mockImplementation(actual.useCancelBooking);
    jest.mocked(addToast).mockClear();
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(new FetchResponse('{', { status: 200 }));
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const invalidated = jest.spyOn(client, 'invalidateQueries');
    render(
      <QueryClientProvider client={client}>
        <BookingsPage />
      </QueryClientProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: action }));
    if (action === 'Edit')
      fireEvent.change(screen.getByRole('spinbutton'), {
        target: { value: '3' },
      });
    const submit = action === 'Edit' ? 'Update Booking' : 'Cancel Booking';
    fireEvent.click(screen.getByRole('button', { name: submit }));
    await waitFor(() =>
      expect(addToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Error', color: 'danger' })
      )
    );
    expect(fetch).toHaveBeenCalledWith(
      '/api/bookings/' + mockBooking._id,
      expect.objectContaining({
        method: action === 'Edit' ? 'PATCH' : 'DELETE',
      })
    );
    expect(invalidated).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: submit })).toBeInTheDocument();
    if (action === 'Edit')
      expect(screen.getByRole('spinbutton')).toHaveValue(3);
    expect(addToast).not.toHaveBeenCalledWith(
      expect.objectContaining({ color: 'success' })
    );
  }
);

describe.each(['cabin', 'dining', 'experience'] as const)(
  '%s cancellation feedback',
  kind => {
    test.each([
      'session changes',
      'view unmounts',
      'refresh removes eligibility',
    ] as const)('%s before the response arrives', async transition => {
      if (kind !== 'cabin') {
        mockBookings = [];
        mockReservation = kind;
      }
      const cancel =
        kind === 'cabin'
          ? mockCancelBooking
          : kind === 'dining'
            ? mockCancelDining
            : mockCancelExperience;
      let complete: () => void = () => {
        throw new Error('No pending cancellation');
      };
      cancel.mockImplementationOnce(
        () =>
          new Promise<void>((resolve, reject) => {
            complete = () => {
              if (transition === 'view unmounts')
                reject(new Error('Old cancellation failed'));
              else resolve();
            };
          })
      );
      const view = render(<BookingsPage />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      if (kind === 'cabin')
        fireEvent.click(screen.getByRole('button', { name: 'Cancel Booking' }));
      expect(cancel).toHaveBeenCalledTimes(1);
      if (transition === 'view unmounts') view.unmount();
      else {
        if (transition === 'session changes')
          mockAuth = { ...mockAuth, sessionId: 'replacement' };
        else {
          mockBookings = mockBookings.map(row => ({
            ...row,
            status: 'cancelled',
          }));
          mockReservation = undefined;
        }
        view.rerender(<BookingsPage />);
      }
      jest.mocked(addToast).mockClear();
      await act(async () => complete());
      if (transition === 'refresh removes eligibility')
        expect(addToast).toHaveBeenCalledWith(
          expect.objectContaining({ color: 'success' })
        );
      else expect(addToast).not.toHaveBeenCalled();
    });
  }
);
