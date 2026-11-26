import { addToast } from '@heroui/toast';
import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import { FetchResponse } from '@/__tests__/shared/checkout-failure-fixtures';
import {
  act,
  createTestQueryClient,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@/__tests__/shared/test-utils';
import PaymentButton from '@/components/PaymentButton';
import { ReservationCheckout } from '@/components/ReservationCheckout';

let mockUser = 'original-user';
let mockSession = 'original-session';
jest.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    userId: mockUser,
    sessionId: mockSession,
  }),
}));
jest.mock('@heroui/toast', () => ({ addToast: jest.fn() }));
jest.mock('@heroui/button', () => ({
  Button: ({
    children,
    isLoading,
    onPress,
  }: {
    children: React.ReactNode;
    isLoading?: boolean;
    onPress: () => void;
  }) => (
    <button disabled={isLoading} onClick={onPress}>
      {children}
    </button>
  ),
}));

const originalId = '507f1f77bcf86cd7994390ab';
const replacementId = '507f1f77bcf86cd7994390cd';
type Kind = 'cabin' | 'dining' | 'experience';
type Change = 'unchanged' | 'session' | 'user' | 'resource' | 'unmount';

beforeEach(() => {
  mockUser = 'original-user';
  mockSession = 'original-session';
  jest.mocked(fetch).mockReset();
  jest.mocked(addToast).mockClear();
  window.history.replaceState(null, '', '/checkout-controls');
});

function successfulCheckout() {
  // jsdom supports same-document hash navigation. Supply an absolute URL
  // so the real checkout decoder and the native navigation path both run.
  const url = window.location.href + '#checkout%2FSession';
  return {
    url,
    response: FetchResponse.json({ success: true, data: { url } }),
  };
}

function mountCheckout(kind: Kind) {
  const client = createTestQueryClient();
  function element(id: string) {
    return (
      <QueryClientProvider client={client}>
        {kind === 'cabin' ? (
          <PaymentButton amount={75} bookingId={id} />
        ) : (
          <ReservationCheckout
            id={id}
            isPaid={false}
            kind={kind}
            status='confirmed'
          />
        )}
      </QueryClientProvider>
    );
  }

  const view = render(element(originalId));
  return {
    client,
    press: () => fireEvent.click(screen.getByRole('button', { name: /^Pay/ })),
    change(change: Change) {
      if (change === 'unchanged') return;
      if (change === 'unmount') {
        view.unmount();
        return;
      }
      if (change === 'session') mockSession = 'replacement-session';
      if (change === 'user') mockUser = 'replacement-user';
      view.rerender(
        element(change === 'resource' ? replacementId : originalId)
      );
    },
  };
}

function holdCheckout() {
  let finish: (response: Response) => void = () => {
    throw new Error('Checkout response was not held');
  };
  jest.mocked(fetch).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      })
  );
  return (response: Response) => act(async () => finish(response));
}

const changes: readonly Change[] = [
  'unchanged',
  'session',
  'user',
  'resource',
  'unmount',
];

describe.each(['cabin', 'dining', 'experience'] as const)(
  '%s checkout',
  kind => {
    test.each(changes)(
      'applies deferred success for scope: %s',
      async change => {
        const initialUrl = window.location.href;
        const { url, response } = successfulCheckout();
        const finish = holdCheckout();
        const checkout = mountCheckout(kind);
        checkout.press();
        await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
        checkout.change(change);
        await finish(response);
        expect(window.location.href).toBe(
          change === 'unchanged' ? url : initialUrl
        );
      }
    );

    test('discards a late error and frees the replacement session to pay', async () => {
      const finish = holdCheckout();
      const checkout = mountCheckout(kind);
      checkout.press();
      await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
      checkout.change('session');
      await finish(
        FetchResponse.json(
          { success: false, error: 'Earlier checkout denied' },
          { status: 409 }
        )
      );
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(addToast).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: /^Pay/ })).toBeEnabled();
    });
  }
);

test.each(changes)(
  'dispatches a queued cabin checkout on reconnect for scope: %s',
  async change => {
    const initialUrl = window.location.href;
    const { url, response } = successfulCheckout();
    jest.mocked(fetch).mockResolvedValueOnce(response);
    const checkout = mountCheckout('cabin');
    onlineManager.setOnline(false);
    try {
      checkout.press();
      await waitFor(() =>
        expect(
          checkout.client
            .getMutationCache()
            .getAll()
            .map(mutation => mutation.state.isPaused)
        ).toEqual([true])
      );
      expect(fetch).not.toHaveBeenCalled();
      checkout.change(change);
      await act(async () => {
        onlineManager.setOnline(true);
        await checkout.client.resumePausedMutations();
      });
      if (change === 'unchanged') {
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch).toHaveBeenCalledWith('/api/payments/create-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId: originalId }),
        });
        expect(window.location.href).toBe(url);
      } else {
        expect(fetch).not.toHaveBeenCalled();
        expect(window.location.href).toBe(initialUrl);
        expect(addToast).not.toHaveBeenCalled();
      }
    } finally {
      onlineManager.setOnline(true);
      checkout.client.clear();
    }
  }
);
