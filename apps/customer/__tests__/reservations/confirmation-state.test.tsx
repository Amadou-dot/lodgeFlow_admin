import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CabinConfirmation from '@/app/cabins/confirmation/[id]/page';
import DiningConfirmation from '@/app/dining/confirmation/[id]/page';
import ExperienceConfirmation from '@/app/experiences/confirmation/[id]/page';
import { createCabinFixture } from '@/__tests__/shared/cabin-fixture';

let mockLoaded = true;
let mockSignedIn = true;
jest.mock('@clerk/nextjs', () => ({
  useUser: () => ({
    user: mockSignedIn
      ? {
          id: 'guest',
          emailAddresses: [{ emailAddress: 'guest@example.com' }],
        }
      : null,
    isLoaded: mockLoaded,
  }),
}));
// The shared framer-motion mock cannot render HeroUI's click ripple.
// Keep our payment components and their query hooks real.
jest.mock('@heroui/button', () => ({
  Button: ({
    children,
    onPress,
  }: {
    children: React.ReactNode;
    onPress?: () => void;
  }) => <button onClick={onPress}>{children}</button>,
}));

const cases = [
  { kind: 'cabin', Page: CabinConfirmation, key: 'booking', noun: 'booking' },
  {
    kind: 'dining',
    Page: DiningConfirmation,
    key: 'dining-reservation',
    noun: 'reservation',
  },
  {
    kind: 'experience',
    Page: ExperienceConfirmation,
    key: 'experience-booking',
    noun: 'booking',
  },
] as const;
function fixture({
  kind,
  id,
  customer = 'guest',
}: {
  kind: 'cabin' | 'dining' | 'experience';
  id: string;
  customer?: string;
}) {
  const common = {
    _id: id,
    customer,
    status: 'confirmed',
    totalPrice: 50,
    isPaid: false,
    specialRequests: [],
  };
  if (kind === 'cabin')
    return {
      ...common,
      id,
      cabin: createCabinFixture(),
      checkInDate: '2030-06-01',
      checkOutDate: '2030-06-03',
      numGuests: 2,
      numNights: 2,
      cabinPrice: 50,
    };
  if (kind === 'dining')
    return {
      ...common,
      dining: null,
      date: '2030-06-01',
      time: '19:00',
      numGuests: 2,
      dietaryRequirements: [],
    };
  return {
    ...common,
    experience: null,
    date: '2030-06-01',
    numParticipants: 2,
  };
}
function response(data: unknown, ok = true) {
  return { ok, json: async () => data } satisfies Pick<Response, 'ok' | 'json'>;
}
function setup(Page: typeof CabinConfirmation, id = 'first', retry = 0) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry, retryDelay: 0, gcTime: Infinity } },
  });
  const element = (params: Promise<{ id: string }>) => (
    <QueryClientProvider client={client}>
      <Page params={params} />
    </QueryClientProvider>
  );
  const view = render(element(Promise.resolve({ id })));
  return {
    client,
    ...view,
    element,
    change: (params: Promise<{ id: string }>) => view.rerender(element(params)),
  };
}
beforeEach(() => {
  mockLoaded = true;
  mockSignedIn = true;
  jest.mocked(fetch).mockReset();
});

for (const { kind, Page, key, noun } of cases) {
  test(`${kind} preserves server errors and clears them on successful retry`, async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(
        response(
          { success: false, error: 'Owned resource unavailable' },
          false
        ) as Response
      );
    jest.mocked(fetch).mockResolvedValueOnce(
      response({
        success: true,
        data: fixture({ kind, id: 'first' }),
      }) as Response
    );
    setup(Page);
    expect(
      await screen.findByText('Owned resource unavailable')
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(await screen.findByText('first')).toBeInTheDocument();
    expect(
      screen.queryByText('Owned resource unavailable')
    ).not.toBeInTheDocument();
  });
  test(`${kind} hides the previous resource immediately while new route params resolve`, async () => {
    jest.mocked(fetch).mockResolvedValue(
      response({
        success: true,
        data: fixture({ kind, id: 'first' }),
      }) as Response
    );
    const view = setup(Page);
    await screen.findByText('first');
    view.change(new Promise(() => {}));
    expect(screen.queryByText('first')).not.toBeInTheDocument();
    expect(screen.getByText(`Loading ${noun} details...`)).toBeInTheDocument();
  });
  test(`${kind} ignores an older request completing after a newer route`, async () => {
    let finishOld: (value: Response) => void = () => {};
    jest.mocked(fetch).mockReturnValueOnce(
      new Promise(resolve => {
        finishOld = resolve;
      })
    );
    const view = setup(Page);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    jest.mocked(fetch).mockResolvedValue(
      response({
        success: true,
        data: fixture({ kind, id: 'second' }),
      }) as Response
    );
    view.change(Promise.resolve({ id: 'second' }));
    await screen.findByText('second');
    await act(async () =>
      finishOld(
        response({
          success: true,
          data: fixture({ kind, id: 'first' }),
        }) as Response
      )
    );
    expect(screen.getByText('second')).toBeInTheDocument();
    expect(screen.queryByText('first')).not.toBeInTheDocument();
  });
  test(`${kind} refreshes authoritative detail without converting a background failure into not-found`, async () => {
    jest.mocked(fetch).mockResolvedValue(
      response({
        success: true,
        data: fixture({ kind, id: 'first' }),
      }) as Response
    );
    const view = setup(Page);
    await screen.findByText('first');
    jest.mocked(fetch).mockRejectedValue(new Error('offline'));
    await act(async () => {
      await view.client.invalidateQueries({ queryKey: [key, 'first'] });
    });
    expect(screen.getByText('first')).toBeInTheDocument();
    expect(screen.queryByText(/Not Found/)).not.toBeInTheDocument();
    jest.mocked(fetch).mockResolvedValue(
      response({
        success: true,
        data: fixture({ kind, id: 'first', customer: 'someone-else' }),
      }) as Response
    );
    await act(async () => {
      await view.client.invalidateQueries({ queryKey: [key, 'first'] });
    });
    expect(await screen.findByText('Unauthorized Access')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^Pay / })
    ).not.toBeInTheDocument();
  });
  test(`${kind} waits for Clerk before fetching`, async () => {
    mockLoaded = false;
    jest.mocked(fetch).mockResolvedValue(
      response({
        success: true,
        data: fixture({ kind, id: 'first' }),
      }) as Response
    );
    const view = setup(Page);
    await act(async () => {});
    expect(fetch).not.toHaveBeenCalled();
    mockLoaded = true;
    view.change(Promise.resolve({ id: 'first' }));
    await screen.findByText('first');
  });
}

for (const { kind, Page, noun } of cases) {
  test(`${kind} preserves immediate failure rather than inheriting global automatic retries`, async () => {
    jest.mocked(fetch).mockRejectedValue(new Error('offline'));
    setup(Page, 'first', 3);
    expect(
      await screen.findByText(`Failed to load ${noun}`)
    ).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  test.each(['status', 'envelope'] as const)(
    `${kind} preserves the %s fallback error`,
    async failure => {
      jest
        .mocked(fetch)
        .mockResolvedValue(
          response({ success: false }, failure !== 'status') as Response
        );
      setup(Page);
      const message =
        kind === 'cabin' && failure === 'status'
          ? 'Failed to load booking'
          : noun === 'reservation'
            ? 'Reservation not found'
            : 'Booking not found';
      expect(await screen.findByText(message)).toBeInTheDocument();
    }
  );
}

for (const { kind, Page, key } of cases) {
  const cachedView = () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    client.setQueryData(
      [key, 'private-record'],
      fixture({ kind, id: 'private-record' })
    );
    const params = Promise.resolve({ id: 'private-record' });
    const element = () => (
      <QueryClientProvider client={client}>
        <Page params={params} />
      </QueryClientProvider>
    );
    return { client, element, ...render(element()) };
  };
  test(`${kind} hides private cached detail immediately after sign-out and on a signed-out remount`, async () => {
    const view = cachedView();
    await screen.findByText('private-record');
    mockSignedIn = false;
    view.rerender(view.element());
    await act(async () => {});
    expect(screen.queryByText('private-record')).not.toBeInTheDocument();
    expect(screen.getByText('Unauthorized Access')).toBeInTheDocument();
    view.unmount();
    render(view.element());
    await act(async () => {});
    expect(screen.queryByText('private-record')).not.toBeInTheDocument();
    expect(screen.getByText('Unauthorized Access')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
  test.each([401, 403, 404])(
    `${kind} hides cached detail after definitive HTTP %s and preserves its server error`,
    async status => {
      const view = cachedView();
      await screen.findByText('private-record');
      if (status === 401) {
        mockSignedIn = false;
        view.unmount();
        render(view.element());
      }
      jest.mocked(fetch).mockResolvedValue({
        ...response(
          { success: false, error: 'Record no longer accessible' },
          false
        ),
        status,
      } as Response);
      await act(async () => {
        await view.client.invalidateQueries({
          queryKey: [key, 'private-record'],
        });
      });
      expect(
        await screen.findByText('Record no longer accessible')
      ).toBeInTheDocument();
      expect(screen.queryByText('private-record')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /^Pay / })
      ).not.toBeInTheDocument();
    }
  );
  test(`${kind} retains valid owned cached detail after HTTP 503`, async () => {
    const view = cachedView();
    await screen.findByText('private-record');
    jest.mocked(fetch).mockResolvedValue({
      ...response({ success: false, error: 'Temporarily unavailable' }, false),
      status: 503,
    } as Response);
    await act(async () => {
      await view.client.invalidateQueries({
        queryKey: [key, 'private-record'],
      });
    });
    expect(screen.getByText('private-record')).toBeInTheDocument();
    expect(screen.queryByText(/Not Found/)).not.toBeInTheDocument();
  });
}

for (const { kind, Page, key, noun } of cases) {
  test(`${kind} ignores a canceled request's denial after a newer authorized read`, async () => {
    const data = fixture({ kind, id: 'private-record' });
    jest.mocked(fetch).mockResolvedValue({
      ...response({ success: true, data }),
      status: 200,
    } as Response);
    const view = setup(Page, 'private-record');
    await screen.findByText('private-record');

    let finishOlderRequest: (value: Response) => void = () => {};
    jest.mocked(fetch).mockReturnValueOnce(
      new Promise(resolve => {
        finishOlderRequest = resolve;
      })
    );
    await act(async () => {
      void view.client.invalidateQueries({
        queryKey: [key, 'private-record'],
      });
    });
    const authorizedData = {
      ...data,
      specialRequests: ['Fresh authorized details'],
    };
    jest.mocked(fetch).mockResolvedValue({
      ...response({ success: true, data: authorizedData }),
      status: 200,
    } as Response);
    await act(async () => {
      await view.client.invalidateQueries({
        queryKey: [key, 'private-record'],
      });
    });
    expect(
      await screen.findByText('Fresh authorized details')
    ).toBeInTheDocument();
    await act(async () => {
      finishOlderRequest({
        ...response(
          { success: false, error: 'Record no longer accessible' },
          false
        ),
        status: 404,
      } as Response);
    });
    expect(view.client.getQueryData([key, 'private-record'])).toEqual(
      authorizedData
    );
    expect(screen.getByText('Fresh authorized details')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Pay / })).toBeInTheDocument();
  });

  describe.each([401, 403, 404])(`${kind} after HTTP %s`, status => {
    test.each(['network failure', 'HTTP 503'] as const)(
      'keeps denied detail and checkout hidden through a %s retry and remount until an authorized read succeeds',
      async failure => {
        const data = fixture({ kind, id: 'private-record' });
        jest.mocked(fetch).mockResolvedValue({
          ...response({ success: true, data }),
          status: 200,
        } as Response);
        const view = setup(Page, 'private-record');
        await screen.findByText('private-record');
        expect(
          screen.getByRole('button', { name: /^Pay / })
        ).toBeInTheDocument();

        jest.mocked(fetch).mockResolvedValue({
          ...response(
            { success: false, error: 'Record no longer accessible' },
            false
          ),
          status,
        } as Response);
        await act(async () => {
          await view.client.invalidateQueries({
            queryKey: [key, 'private-record'],
          });
        });
        expect(
          await screen.findByText('Record no longer accessible')
        ).toBeInTheDocument();
        expect(screen.queryByText('private-record')).not.toBeInTheDocument();
        expect(
          screen.queryByRole('button', { name: /^Pay / })
        ).not.toBeInTheDocument();

        if (failure === 'network failure') {
          jest.mocked(fetch).mockRejectedValue(new Error('offline'));
        } else {
          jest.mocked(fetch).mockResolvedValue({
            ...response(
              { success: false, error: 'Temporarily unavailable' },
              false
            ),
            status: 503,
          } as Response);
        }
        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
        });
        expect(screen.queryByText('private-record')).not.toBeInTheDocument();
        expect(
          screen.queryByRole('button', { name: /^Pay / })
        ).not.toBeInTheDocument();
        const retryError =
          failure === 'network failure'
            ? `Failed to load ${noun}`
            : 'Temporarily unavailable';
        expect(await screen.findByText(retryError)).toBeInTheDocument();

        view.unmount();
        render(view.element(Promise.resolve({ id: 'private-record' })));
        expect(await screen.findByText(retryError)).toBeInTheDocument();
        expect(screen.queryByText('private-record')).not.toBeInTheDocument();
        expect(
          screen.queryByRole('button', { name: /^Pay / })
        ).not.toBeInTheDocument();

        jest.mocked(fetch).mockResolvedValue({
          ...response({ success: true, data }),
          status: 200,
        } as Response);
        fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
        expect(await screen.findByText('private-record')).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: /^Pay / })
        ).toBeInTheDocument();
        expect(screen.queryByText(retryError)).not.toBeInTheDocument();
      }
    );
  });
}
