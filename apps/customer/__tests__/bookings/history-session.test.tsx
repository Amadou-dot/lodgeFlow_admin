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
}: {
  resource: Resource;
  owner: string;
}) {
  const common = {
    _id: `${owner}-${resource.kind}`,
    customer: owner,
    status: 'confirmed' as const,
    totalPrice: 20,
    isPaid: false,
  };
  const row =
    resource.kind === 'cabin'
      ? ({
          ...common,
          cabin: null,
          checkInDate: '2030-01-01',
          checkOutDate: '2030-01-03',
          numNights: 2,
          numGuests: 2,
          cabinPrice: 10,
        } satisfies BookingHistoryItem)
      : resource.kind === 'dining'
        ? ({
            ...common,
            dining: null,
            date: '2030-01-01',
            time: '19:00',
            numGuests: 2,
          } satisfies DiningReservationHistory)
        : ({
            ...common,
            experience: null,
            date: '2030-01-01',
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
        <p key={record._id}>{record._id}</p>
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
        historyResponse({ resource, owner: 'new-session' })
      )
      .mockResolvedValueOnce(historyResponse({ resource, owner: 'refreshed' }));
    const view = setup(resource);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    mockAuth = { ...mockAuth, sessionId: 'alice-new-session' };
    view.rerender();
    await screen.findByText(`new-session-${resource.kind}`);
    expect(oldSignal?.aborted).toBe(true);
    await act(async () =>
      finishOld(historyResponse({ resource, owner: 'old-session' }))
    );
    expect(
      screen.queryByText(`old-session-${resource.kind}`)
    ).not.toBeInTheDocument();
    await act(async () => {
      await view.client.invalidateQueries({ queryKey: [resource.key] });
    });
    await screen.findByText(`refreshed-${resource.kind}`);
    expect(
      view.client.getQueriesData({ queryKey: [resource.key] })
    ).toHaveLength(1);
  }
);
