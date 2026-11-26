import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DynamicClerkProvider } from '@/components/DynamicClerkProvider';
import { useBookingHistory } from '@/hooks/useBooking';
import { useDiningReservationHistory } from '@/hooks/useDiningReservation';
import { useExperienceBookingHistory } from '@/hooks/useExperienceBooking';
import type { BookingHistoryItem } from '@/types/booking-read';
import type {
  DiningReservationHistory,
  ExperienceReservationHistory,
} from '@lodgeflow/database/reservation-json';

type HistoryResponse = Pick<Response, 'ok' | 'status' | 'json' | 'redirected'>;
const mockFetch = jest.fn<
  Promise<HistoryResponse>,
  [RequestInfo | URL, RequestInit?]
>();

let mockAuth = {
  isLoaded: true,
  isSignedIn: true,
  userId: 'alice',
  sessionId: 'alice-session',
};
jest.mock('@clerk/nextjs', () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => mockAuth,
}));
jest.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));
jest.mock('@clerk/themes', () => ({ dark: {} }), { virtual: true });

const resources = [
  { kind: 'cabin', key: 'bookings-history', useHistory: useBookingHistory },
  {
    kind: 'dining',
    key: 'dining-reservations-history',
    useHistory: useDiningReservationHistory,
  },
  {
    kind: 'experience',
    key: 'experience-bookings-history',
    useHistory: useExperienceBookingHistory,
  },
] as const;
type Resource = (typeof resources)[number];
function historyResponse({
  resource,
  owner,
  revision,
}: {
  resource: Resource;
  owner: string;
  revision?: number;
}) {
  const common = {
    _id: '507f1f77bcf86cd799439011',
    customer: owner,
    totalPrice: revision ?? 20,
    status: 'confirmed' as const,
    isPaid: false,
  };
  const row =
    resource.kind === 'cabin'
      ? ({
          ...common,
          cabin: null,
          checkInDate: '2030-01-01T00:00:00.000Z',
          checkOutDate: '2030-01-03T00:00:00.000Z',
          numNights: 2,
          numGuests: 2,
          cabinPrice: 10,
        } satisfies BookingHistoryItem)
      : resource.kind === 'dining'
        ? ({
            ...common,
            dining: null,
            date: '2030-01-01T00:00:00.000Z',
            time: '19:00',
            numGuests: 2,
          } satisfies DiningReservationHistory)
        : ({
            ...common,
            experience: null,
            date: '2030-01-01T00:00:00.000Z',
            numParticipants: 2,
          } satisfies ExperienceReservationHistory);
  return {
    ok: true,
    status: 200,
    redirected: false,
    json: async () => ({ success: true, data: [row] }),
  } satisfies HistoryResponse;
}
function Probe({ resource }: { resource: Resource }) {
  const query = resource.useHistory('confirmed');
  return (
    <div>
      {query.data?.map(record => (
        <p key={record._id}>
          {record.customer}-{resource.kind}
          {record.totalPrice === 20 ? '' : `-${record.totalPrice}`}
        </p>
      ))}
    </div>
  );
}
function setup(resource: Resource) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
    },
  });
  const element = (show = true) => (
    <QueryClientProvider client={client}>
      <DynamicClerkProvider>
        {show ? <Probe resource={resource} /> : <p>Public page</p>}
      </DynamicClerkProvider>
    </QueryClientProvider>
  );
  const view = render(element());
  return { client, rerender: (show = true) => view.rerender(element(show)) };
}
beforeEach(() => {
  mockAuth = {
    isLoaded: true,
    isSignedIn: true,
    userId: 'alice',
    sessionId: 'alice-session',
  };
  mockFetch.mockReset();
  Object.defineProperty(global, 'fetch', {
    configurable: true,
    writable: true,
    value: mockFetch,
  });
});

test.each(resources)(
  '$kind does not fetch during auth loading or after sign-out',
  async resource => {
    mockAuth = {
      isLoaded: false,
      isSignedIn: false,
      userId: '',
      sessionId: '',
    };
    mockFetch.mockResolvedValue(historyResponse({ resource, owner: 'alice' }));
    const view = setup(resource);
    await act(async () => {});
    expect(fetch).not.toHaveBeenCalled();
    mockAuth = { ...mockAuth, isLoaded: true };
    view.rerender();
    await act(async () => {});
    expect(fetch).not.toHaveBeenCalled();
  }
);

test.each(resources)(
  '$kind hides cached history immediately when switching accounts and clears it away from history',
  async resource => {
    let finishBob: (response: HistoryResponse) => void = () => {
      throw new Error('Bob request not started');
    };
    mockFetch
      .mockResolvedValueOnce(historyResponse({ resource, owner: 'alice' }))
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            finishBob = resolve;
          })
      );
    const view = setup(resource);
    await screen.findByText(`alice-${resource.kind}`);
    view.client.setQueryData(['cabins'], ['public-cabin']);
    mockAuth = { ...mockAuth, userId: 'bob', sessionId: 'bob-session' };
    view.rerender();
    expect(
      screen.queryByText(`alice-${resource.kind}`)
    ).not.toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await act(async () =>
      finishBob(historyResponse({ resource, owner: 'bob' }))
    );
    await screen.findByText(`bob-${resource.kind}`);
    view.rerender(false);
    mockAuth = { isLoaded: true, isSignedIn: false, userId: '', sessionId: '' };
    view.rerender(false);
    await waitFor(() =>
      expect(
        view.client
          .getQueriesData({ queryKey: [resource.key] })
          .filter(([, data]) => data !== undefined)
      ).toEqual([])
    );
    expect(view.client.getQueryData(['cabins'])).toEqual(['public-cabin']);
    view.rerender();
    expect(screen.queryByText(`bob-${resource.kind}`)).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(2);
  }
);

test.each(resources)(
  '$kind cancels an old session read and preserves prefix invalidation for a new session',
  async resource => {
    let finishOld: (response: HistoryResponse) => void = () => {
      throw new Error('Old request not started');
    };
    let oldSignal: AbortSignal | null | undefined;
    mockFetch
      .mockImplementationOnce((_url, options) => {
        oldSignal = options?.signal;
        return new Promise(resolve => {
          finishOld = resolve;
        });
      })
      .mockResolvedValueOnce(
        historyResponse({ resource, owner: 'alice', revision: 21 })
      )
      .mockResolvedValueOnce(
        historyResponse({ resource, owner: 'alice', revision: 23 })
      );
    const view = setup(resource);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    mockAuth = { ...mockAuth, sessionId: 'alice-new-session' };
    view.rerender();
    await screen.findByText(`alice-${resource.kind}-21`);
    expect(oldSignal?.aborted).toBe(true);
    await act(async () =>
      finishOld(historyResponse({ resource, owner: 'alice', revision: 22 }))
    );
    expect(
      screen.queryByText(`alice-${resource.kind}-22`)
    ).not.toBeInTheDocument();
    await act(async () => {
      await view.client.invalidateQueries({ queryKey: [resource.key] });
    });
    await screen.findByText(`alice-${resource.kind}-23`);
    expect(
      view.client.getQueriesData({ queryKey: [resource.key] })
    ).toHaveLength(1);
  }
);

describe.each(resources)('$kind history contents', resource => {
  test.each([
    'foreign',
    'mixed owner',
    'wrong status',
    'mixed status',
    'empty',
  ] as const)(
    'validates %s against the requested owner and filter',
    async scenario => {
      const response = historyResponse({ resource, owner: 'alice' });
      const {
        data: [alice],
      } = await response.json();
      const bad = scenario.includes('status')
        ? { ...alice, status: 'cancelled' }
        : { ...alice, customer: 'bob' };
      const data =
        scenario === 'empty'
          ? []
          : scenario.startsWith('mixed')
            ? [alice, bad]
            : [bad];
      mockFetch.mockResolvedValue({
        ...response,
        json: async () => ({ success: true, data }),
      });
      const { client } = setup(resource);
      const key = [resource.key, 'confirmed', 'alice', 'alice-session'];
      await waitFor(() =>
        expect(client.getQueryState(key)?.status).toBe(
          scenario === 'empty' ? 'success' : 'error'
        )
      );
      expect(client.getQueryData(key)).toEqual(
        scenario === 'empty' ? [] : undefined
      );
    }
  );
});
