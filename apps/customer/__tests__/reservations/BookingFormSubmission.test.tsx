import { ProviderContext } from '@heroui/system';
import userEvent from '@testing-library/user-event';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { parseDate, type CalendarDate } from '@internationalized/date';
import { addToast } from '@heroui/toast';
import { FetchResponse } from '@/__tests__/shared/checkout-failure-fixtures';
import DiningReservationForm from '@/components/DiningReservationForm';
import ExperienceBookingForm from '@/components/ExperienceBookingForm';
import BookingForm from '@/components/BookingForm';
import BookingsPage from '@/app/bookings/page';
import type { Dining, Experience } from '@/types';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a data-client-navigation href={href}>
      {children}
    </a>
  ),
}));
const mockPush = jest.fn();
let mockUser = 'guest';
let mockSession = 'session';
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    userId: mockUser,
    sessionId: mockSession,
    isLoaded: true,
    isSignedIn: true,
  }),
  useUser: () => ({ user: { id: mockUser }, isLoaded: true, isSignedIn: true }),
}));
jest.mock('@heroui/ripple', () => ({
  ...jest.requireActual<Record<string, unknown>>('@heroui/ripple'),
  Ripple: () => null,
}));
jest.mock('@heroui/toast', () => ({ addToast: jest.fn() }));
jest.mock('@/hooks/useSettings', () => ({ useSettings: () => ({}) }));
jest.mock('@heroui/date-picker', () => ({
  DatePicker: ({
    value,
    onChange,
  }: {
    value: CalendarDate | null;
    onChange: (date: CalendarDate) => void;
  }) => (
    <button
      data-selection={value?.toString()}
      onClick={() => onChange(parseDate('2040-02-01'))}
    >
      Pick day
    </button>
  ),
  DateRangePicker: ({
    value,
    onChange,
  }: {
    value: { start: CalendarDate; end: CalendarDate } | null;
    onChange: (range: { start: CalendarDate; end: CalendarDate }) => void;
  }) => (
    <button
      data-selection={value && [value.start, value.end].join('/')}
      type='button'
      onClick={() =>
        onChange({
          start: parseDate('2040-02-01'),
          end: parseDate('2040-02-02'),
        })
      }
    >
      Pick day
    </button>
  ),
}));
const id = '507f1f77bcf86cd7994390ab';
const listing = '507f1f77bcf86cd7994390cd';
const servingTime = { start: '17:00', end: '19:00' };
const dining = {
  _id: listing,
  name: 'Dinner',
  description: 'Dinner',
  price: 25,
  image: '/d.jpg',
  type: 'menu',
  mealType: 'dinner',
  category: 'regular',
  maxPeople: 4,
  servingTime,
} satisfies Dining;
const experience = {
  _id: listing,
  name: 'Hike',
  description: 'Hike',
  price: 25,
  image: '/e.jpg',
  category: 'Local',
  difficulty: 'Easy',
  duration: '1h',
  ctaText: 'Book',
} satisfies Experience;
const cabin = { _id: listing, name: 'Cabin', regularPrice: 25, maxCapacity: 4 };
const userData = {
  firstName: 'Test',
  lastName: 'Guest',
  phone: '123456789',
  email: 'guest@example.com',
};

type Kind = 'dining' | 'experience' | 'cabin';
const paths = {
  dining: ['/api/dining-reservations', '/dining/confirmation/', 'Reserve Now'],
  experience: [
    '/api/experience-bookings',
    '/experiences/confirmation/',
    'Book Experience',
  ],
  cabin: ['/api/bookings', '/cabins/confirmation/', 'Submit Booking Request'],
};
function record(kind: Kind, totalPrice = 0) {
  const common = {
    _id: id,
    id,
    customer: 'guest',
    totalPrice,
    isPaid: false,
    specialRequests: [null, 'Quiet'],
  };
  if (kind === 'cabin')
    return {
      ...common,
      cabin: null,
      checkInDate: '2040-02-01T00:00:00.000Z',
      checkOutDate: '2040-02-02T00:00:00.000Z',
      numNights: 1,
      numGuests: 2,
      status: 'unconfirmed',
      cabinPrice: 25,
    };
  const shared = {
    ...common,
    date: '2040-02-01T00:00:00.000Z',
    status: 'pending',
  };
  return kind === 'dining'
    ? { ...shared, dining: null, time: '17:00', numGuests: 1 }
    : { ...shared, experience: null, numParticipants: 1 };
}
const reply = (data: unknown) =>
  FetchResponse.json({ success: true, data }, { status: 201 });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}
async function mount(
  kind: Kind,
  create: () => Promise<Response>,
  checkout?: () => Promise<Response>,
  chooseDraft = false
) {
  const [createPath, , label] = paths[kind];
  const createPost = jest.fn(create);
  const checkoutPost = jest.fn(checkout);
  jest.mocked(fetch).mockImplementation(async (path, init) => {
    if (path === createPath && init?.method === 'POST') return createPost();
    if (String(path).endsWith('/checkout')) {
      const response = checkoutPost();
      if (response) return response;
      throw new Error('Unexpected checkout');
    }
    if (String(path).includes('/availability')) {
      const url = new URL(String(path), 'https://local.test');
      const data =
        kind === 'cabin'
          ? { unavailableDates: [] }
          : {
              diningId: listing,
              date: '2040-02-01',
              time: url.searchParams.get('time'),
              seatsRemaining: null,
              maxPeople: null,
              isAvailable: true,
              servingTime,
            };
      return FetchResponse.json({ success: true, data });
    }
    throw new Error('Unexpected request');
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidated = jest.spyOn(client, 'invalidateQueries');
  let listingId = listing;
  const ui = () => (
    <QueryClientProvider client={client}>
      <ProviderContext value={{ disableAnimation: true }}>
        {kind === 'dining' ? (
          <DiningReservationForm dining={{ ...dining, _id: listingId }} />
        ) : kind === 'experience' ? (
          <ExperienceBookingForm
            experience={{ ...experience, _id: listingId }}
          />
        ) : (
          <BookingForm
            cabin={{ ...cabin, _id: listingId }}
            userData={userData}
          />
        )}
      </ProviderContext>
    </QueryClientProvider>
  );
  const mounted = render(ui());
  fireEvent.click(screen.getByRole('button', { name: 'Pick day' }));
  const user = userEvent.setup();
  if (kind === 'dining' && chooseDraft) {
    await user.click(screen.getByRole('button', { name: /Select Time/ }));
    await user.click(await screen.findByRole('option', { name: '17:00' }));
  } else if (kind !== 'experience') {
    const select = mounted.container.querySelector('select');
    if (!select) throw new Error('Missing selection');
    fireEvent.change(select, {
      target: { value: kind === 'dining' ? '17:00' : '2' },
    });
  }
  if (chooseDraft) {
    if (kind === 'cabin') {
      fireEvent.click(screen.getByRole('checkbox', { name: /add breakfast/ }));
    } else {
      fireEvent.change(screen.getByRole('spinbutton'), {
        target: { value: '3' },
      });
      if (kind === 'dining') {
        await user.click(
          screen.getByRole('button', { name: /Table Preference/ })
        );
        await user.click(
          await screen.findByRole('option', { name: 'Outdoor' })
        );
      }
    }
  }
  const draft = screen.getByRole('textbox', { name: /Special Requests/ });
  fireEvent.change(draft, { target: { value: 'Quiet please' } });
  const button = await screen.findByRole('button', { name: label });
  await waitFor(() => expect(button).toBeEnabled());
  const press = () => fireEvent.click(button);
  return {
    button,
    press,
    createPost,
    checkoutPost,
    invalidated,
    draft,
    client,
    unmount: mounted.unmount,
    rerender: (replacement?: string) => {
      listingId = replacement ?? listingId;
      mounted.rerender(ui());
    },
  };
}
beforeEach(() => {
  jest.clearAllMocks();
  mockUser = 'guest';
  mockSession = 'session';
});

for (const kind of ['dining', 'experience', 'cabin'] as const) {
  test.each([
    'missing data',
    'unreadable body',
    'network interruption',
    'contradictory rejection',
    'unreadable rejection',
    'different owner',
    'unexpected success status',
    'server failure',
  ])(
    kind + ' retains the draft and prevents repeat create after %s',
    async failure => {
      const result = await mount(
        kind,
        async () => {
          if (failure === 'contradictory rejection')
            return FetchResponse.json(
              { success: false, data: record(kind), error: 'Unavailable' },
              { status: 409 }
            );
          if (failure === 'unreadable rejection')
            return new FetchResponse('{', { status: 409 });
          if (failure === 'different owner')
            return reply({ ...record(kind), customer: 'other' });
          if (failure === 'unexpected success status')
            return FetchResponse.json({ success: true, data: record(kind) });
          if (failure === 'network interruption')
            throw new TypeError('network');
          if (failure === 'unreadable body')
            return new FetchResponse('{', { status: 201 });
          if (failure === 'server failure')
            return FetchResponse.json(
              { success: false, error: 'Failed to create' },
              { status: 500 }
            );
          return FetchResponse.json({ success: true }, { status: 201 });
        },
        undefined,
        failure === 'unreadable body'
      );
      result.press();
      await waitFor(() => expect(addToast).toHaveBeenCalled());
      expect(addToast).not.toHaveBeenCalledWith(
        expect.objectContaining({ color: 'success' })
      );
      expect(result.draft).toHaveValue('Quiet please');
      if (failure === 'unreadable body') {
        expect(
          screen.getByRole('button', { name: 'Pick day' })
        ).toHaveAttribute(
          'data-selection',
          kind === 'cabin' ? '2040-02-01/2040-02-02' : '2040-02-01'
        );
        if (kind === 'cabin') {
          expect(screen.getByDisplayValue(/2 guests/i)).toBeInTheDocument();
          expect(
            screen.getByRole('checkbox', { name: /add breakfast/ })
          ).toBeChecked();
        } else {
          expect(screen.getByRole('spinbutton')).toHaveValue(3);
          if (kind === 'dining') {
            expect(screen.getByDisplayValue('17:00')).toBeInTheDocument();
            expect(screen.getByDisplayValue(/outdoor/i)).toBeInTheDocument();
          }
        }
      }
      const history = screen.getByRole('link', {
        name: 'Load current bookings',
      });
      expect(history).toHaveAttribute('href', '/bookings');
      expect(history).not.toHaveAttribute('data-client-navigation');
      expect(
        screen.queryByRole('link', { name: 'View confirmation' })
      ).not.toBeInTheDocument();
      expect(result.invalidated).not.toHaveBeenCalled();
      expect(result.button).toBeDisabled();
      await act(async () => {
        result.press();
      });
      expect(result.createPost).toHaveBeenCalledTimes(1);
      expect(result.checkoutPost).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    }
  );
  test(
    kind +
      ' allows retry after a definitive rejection and holds a successful confirmation handoff',
    async () => {
      const request = jest
        .fn<Promise<Response>, []>()
        .mockResolvedValueOnce(
          FetchResponse.json(
            { success: false, error: 'Unavailable' },
            { status: 409 }
          )
        )
        .mockResolvedValueOnce(reply(record(kind)));
      const result = await mount(kind, request);
      result.press();
      await waitFor(() =>
        expect(addToast).toHaveBeenCalledWith(
          expect.objectContaining({
            color: 'danger',
            description: 'Unavailable',
          })
        )
      );
      expect(result.button).toBeEnabled();
      result.press();
      await waitFor(() =>
        expect(mockPush).toHaveBeenCalledWith(paths[kind][1] + id)
      );
      expect(
        screen.getByRole('link', { name: 'View confirmation' })
      ).toHaveAttribute('href', paths[kind][1] + id);
      expect(result.button).toBeDisabled();
      await act(async () => {
        result.press();
      });
      expect(result.createPost).toHaveBeenCalledTimes(2);
      expect(result.checkoutPost).not.toHaveBeenCalled();
    }
  );
  test(
    kind + ' ignores a late write handoff after the original session ends',
    async () => {
      const pending = deferred<Response>();
      const result = await mount(kind, () => pending.promise);
      result.press();
      await waitFor(() => expect(result.createPost).toHaveBeenCalledTimes(1));
      mockSession = 'new-session';
      result.rerender();
      await act(async () => pending.resolve(reply(record(kind, 25))));
      expect(result.checkoutPost).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
      expect(addToast).not.toHaveBeenCalled();
    }
  );
}
for (const kind of ['dining', 'experience'] as const) {
  test(
    kind +
      ' acknowledges a committed create without detail and holds the draft',
    async () => {
      const result = await mount(kind, async () => reply(null));
      result.press();
      await waitFor(() => expect(addToast).toHaveBeenCalled());
      expect(addToast).not.toHaveBeenCalledWith(
        expect.objectContaining({ color: 'danger' })
      );
      expect(result.button).toBeDisabled();
      await act(async () => {
        result.press();
      });
      expect(result.draft).toHaveValue('Quiet please');
      expect(
        result.invalidated.mock.calls.map(([filter]) => filter?.queryKey)
      ).toContainEqual(
        kind === 'dining'
          ? ['dining-reservations-history']
          : ['experience-bookings-history']
      );
      expect(result.createPost).toHaveBeenCalledTimes(1);
      expect(result.checkoutPost).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    }
  );
  test(
    kind + ' allows only the saved confirmation to recover a failed checkout',
    async () => {
      const pending = deferred<Response>();
      const result = await mount(
        kind,
        async () => reply(record(kind, 25)),
        () => pending.promise
      );
      result.press();
      await waitFor(() => expect(result.checkoutPost).toHaveBeenCalledTimes(1));
      expect(fetch).toHaveBeenCalledWith(
        paths[kind][0] + '/' + id + '/checkout',
        { method: 'POST' }
      );
      expect(result.button).toBeDisabled();
      await act(async () => {
        result.press();
      });
      await act(async () =>
        pending.resolve(
          FetchResponse.json({ error: 'Unavailable' }, { status: 409 })
        )
      );
      expect(addToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Payment still required',
          color: 'warning',
        })
      );
      expect(mockPush).toHaveBeenCalledWith(paths[kind][1] + id);
      expect(
        screen.getByRole('link', { name: 'View confirmation' })
      ).toHaveAttribute('href', paths[kind][1] + id);
      expect(result.button).toBeDisabled();
      await act(async () => {
        result.press();
      });
      expect(result.createPost).toHaveBeenCalledTimes(1);
      expect(result.checkoutPost).toHaveBeenCalledTimes(1);
    }
  );
}

test.each(['dining', 'experience'] as const)(
  '%s ignores a valid checkout URL delivered after the creating session retires',
  async kind => {
    const pending = deferred<Response>();
    const result = await mount(
      kind,
      async () => reply(record(kind, 25)),
      () => pending.promise
    );
    result.press();
    await waitFor(() => expect(result.checkoutPost).toHaveBeenCalledTimes(1));
    const originalUrl = window.location.href;
    mockSession = 'replacement';
    result.rerender();
    await act(async () =>
      pending.resolve(
        FetchResponse.json({
          success: true,
          data: { url: originalUrl + '#checkout' },
        })
      )
    );
    expect(window.location.href).toBe(originalUrl);
    expect(mockPush).not.toHaveBeenCalled();
    expect(addToast).not.toHaveBeenCalledWith(
      expect.objectContaining({ color: 'warning' })
    );
  }
);

test.each(['dining', 'experience'] as const)(
  '%s suppresses late checkout recovery after session replacement',
  async kind => {
    const pending = deferred<Response>();
    const result = await mount(
      kind,
      async () => reply(record(kind, 25)),
      () => pending.promise
    );
    result.press();
    await waitFor(() => expect(result.checkoutPost).toHaveBeenCalledTimes(1));
    mockSession = 'new-session';
    result.rerender();
    await act(async () =>
      pending.resolve(
        FetchResponse.json({ error: 'Unavailable' }, { status: 409 })
      )
    );
    expect(mockPush).not.toHaveBeenCalled();
    expect(addToast).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Payment still required' })
    );
  }
);

for (const kind of ['cabin', 'dining', 'experience'] as const) {
  test.each(['unchanged', 'new listing', 'new session', 'unmounted'] as const)(
    kind + ' form queued offline and then %s',
    async change => {
      const result = await mount(kind, async () => reply(record(kind)));
      onlineManager.setOnline(false);
      try {
        result.press();
        await waitFor(() =>
          expect(
            result.client
              .getMutationCache()
              .getAll()
              .filter(m => m.state.isPaused)
          ).toHaveLength(1)
        );
        expect(result.createPost).not.toHaveBeenCalled();
        if (change === 'new listing')
          result.rerender('507f1f77bcf86cd7994390ee');
        if (change === 'new session') {
          mockSession = 'new-session';
          result.rerender();
        }
        if (change === 'unmounted') result.unmount();
        await act(async () => {
          onlineManager.setOnline(true);
          await result.client.resumePausedMutations();
        });
        if (change === 'unchanged') {
          expect(result.createPost).toHaveBeenCalledTimes(1);
          expect(mockPush).toHaveBeenCalledWith(paths[kind][1] + id);
          expect(
            screen.getByRole('link', { name: 'View confirmation' })
          ).toHaveAttribute('href', paths[kind][1] + id);
        } else {
          expect(result.createPost).not.toHaveBeenCalled();
          expect(result.checkoutPost).not.toHaveBeenCalled();
          expect(result.invalidated).not.toHaveBeenCalled();
          expect(mockPush).not.toHaveBeenCalled();
          expect(
            screen.queryByRole('link', { name: 'View confirmation' })
          ).not.toBeInTheDocument();
        }
      } finally {
        onlineManager.setOnline(true);
        result.client.clear();
      }
    }
  );
}

test('manual history recovery starts fresh unfiltered reads for the signed-in session', async () => {
  const result = await mount(
    'experience',
    async () => new FetchResponse('{', { status: 201 })
  );
  const prefixes = [
    'bookings-history',
    'dining-reservations-history',
    'experience-bookings-history',
  ];
  const keys = prefixes.map(prefix => [
    prefix,
    undefined,
    mockUser,
    mockSession,
  ]);
  for (const key of keys) result.client.setQueryData(key, []);
  result.press();
  const link = await screen.findByRole('link', {
    name: 'Load current bookings',
  });
  expect(link).not.toHaveAttribute('data-client-navigation');
  expect(link).toHaveAttribute('href', '/bookings');
  expect(result.invalidated).not.toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
  const historyPaths = [
    '/api/bookings/history',
    '/api/dining-reservations/history',
    '/api/experience-bookings/history',
  ];
  for (const path of historyPaths)
    expect(fetch).not.toHaveBeenCalledWith(path, expect.anything());
  // jsdom does not perform document navigation. Mount the link destination
  // with a fresh provider, as a full document load does in the application.
  result.unmount();
  const fresh = new QueryClient({
    defaultOptions: { queries: { staleTime: 300000, retry: false } },
  });
  jest
    .mocked(fetch)
    .mockImplementation(async () =>
      FetchResponse.json({ success: true, data: [] })
    );
  render(
    <QueryClientProvider client={fresh}>
      <BookingsPage />
    </QueryClientProvider>
  );
  await waitFor(() =>
    keys.forEach(key => expect(fresh.getQueryData(key)).toEqual([]))
  );
  for (const path of historyPaths)
    expect(fetch).toHaveBeenCalledWith(path, {
      signal: expect.any(AbortSignal),
    });
  expect(result.createPost).toHaveBeenCalledTimes(1);
  expect(mockPush).not.toHaveBeenCalled();
});
