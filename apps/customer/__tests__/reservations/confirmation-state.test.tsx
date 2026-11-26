import { runInThisContext } from 'node:vm';
import { TextEncoder } from 'node:util';
import { FetchResponse } from '@/__tests__/shared/checkout-failure-fixtures';
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

let mockUserId = 'guest';
let mockLoaded = true;
let mockSignedIn = true;
jest.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    isLoaded: mockLoaded,
    isSignedIn: mockSignedIn,
    userId: mockSignedIn ? mockUserId : null,
    sessionId: mockSignedIn ? 'session' : null,
  }),
  useUser: () => ({
    user: mockSignedIn
      ? {
          id: mockUserId,
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

const firstId = '507f1f77bcf86cd7994390a1';
const secondId = '507f1f77bcf86cd7994390a2';
const privateId = '507f1f77bcf86cd7994390a3';
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
    id,
    customer,
    status: 'confirmed',
    totalPrice: 50,
    isPaid: false,
    specialRequests: [],
  };
  if (kind === 'cabin')
    return {
      ...common,
      cabin: createCabinFixture(),
      checkInDate: '2030-06-01T00:00:00.000Z',
      checkOutDate: '2030-06-03T00:00:00.000Z',
      numGuests: 2,
      numNights: 2,
      cabinPrice: 50,
    };
  if (kind === 'dining')
    return {
      ...common,
      dining: null,
      date: '2030-06-01T00:00:00.000Z',
      time: '19:00',
      numGuests: 2,
      dietaryRequirements: [],
    };
  return {
    ...common,
    experience: null,
    date: '2030-06-01T00:00:00.000Z',
    numParticipants: 2,
  };
}
function response(data: unknown, ok = true) {
  return { ok, json: async () => data } satisfies Pick<Response, 'ok' | 'json'>;
}
function setup(Page: typeof CabinConfirmation, id = firstId, retry = 0) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry, retryDelay: 0, gcTime: Infinity } },
  });
  const element = (params: Promise<{ id: string }>) => (
    <QueryClientProvider client={client}>
      <Page params={params} />
    </QueryClientProvider>
  );
  const params = Promise.resolve({ id });
  const view = render(element(params));
  return {
    client,
    ...view,
    element,
    updateAuth: () => view.rerender(element(params)),
    change: (params: Promise<{ id: string }>) => view.rerender(element(params)),
  };
}
beforeEach(() => {
  mockUserId = 'guest';
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
        data: fixture({ kind, id: firstId }),
      }) as Response
    );
    setup(Page);
    expect(
      await screen.findByText('Owned resource unavailable')
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(await screen.findByText(firstId)).toBeInTheDocument();
    expect(
      screen.queryByText('Owned resource unavailable')
    ).not.toBeInTheDocument();
  });
  test(`${kind} hides the previous resource immediately while new route params resolve`, async () => {
    jest.mocked(fetch).mockResolvedValue(
      response({
        success: true,
        data: fixture({ kind, id: firstId }),
      }) as Response
    );
    const view = setup(Page);
    await screen.findByText(firstId);
    view.change(new Promise(() => {}));
    expect(screen.queryByText(firstId)).not.toBeInTheDocument();
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
        data: fixture({ kind, id: secondId }),
      }) as Response
    );
    view.change(Promise.resolve({ id: secondId }));
    await screen.findByText(secondId);
    await act(async () =>
      finishOld(
        response({
          success: true,
          data: fixture({ kind, id: firstId }),
        }) as Response
      )
    );
    expect(screen.getByText(secondId)).toBeInTheDocument();
    expect(screen.queryByText(firstId)).not.toBeInTheDocument();
  });
  test(`${kind} refreshes authoritative detail without converting a background failure into not-found`, async () => {
    jest.mocked(fetch).mockResolvedValue(
      response({
        success: true,
        data: fixture({ kind, id: firstId }),
      }) as Response
    );
    const view = setup(Page);
    await screen.findByText(firstId);
    jest.mocked(fetch).mockRejectedValue(new Error('offline'));
    await act(async () => {
      await view.client.invalidateQueries({ queryKey: [key, firstId] });
    });
    expect(screen.getByText(firstId)).toBeInTheDocument();
    expect(screen.queryByText(/Not Found/)).not.toBeInTheDocument();
    jest.mocked(fetch).mockResolvedValue(
      response({
        success: true,
        data: fixture({ kind, id: firstId, customer: 'someone-else' }),
      }) as Response
    );
    await act(async () => {
      await view.client.invalidateQueries({ queryKey: [key, firstId] });
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
        data: fixture({ kind, id: firstId }),
      }) as Response
    );
    const view = setup(Page);
    await act(async () => {});
    expect(fetch).not.toHaveBeenCalled();
    mockLoaded = true;
    view.change(Promise.resolve({ id: firstId }));
    await screen.findByText(firstId);
  });
}

for (const { kind, Page, noun } of cases) {
  test(`${kind} preserves immediate failure rather than inheriting global automatic retries`, async () => {
    jest.mocked(fetch).mockRejectedValue(new Error('offline'));
    setup(Page, firstId, 3);
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
    client.setQueryData([key, privateId], fixture({ kind, id: privateId }));
    const params = Promise.resolve({ id: privateId });
    const element = () => (
      <QueryClientProvider client={client}>
        <Page params={params} />
      </QueryClientProvider>
    );
    return { client, element, ...render(element()) };
  };
  test(`${kind} hides private cached detail immediately after sign-out and on a signed-out remount`, async () => {
    const view = cachedView();
    await screen.findByText(privateId);
    mockSignedIn = false;
    view.rerender(view.element());
    await act(async () => {});
    expect(screen.queryByText(privateId)).not.toBeInTheDocument();
    expect(screen.getByText('Unauthorized Access')).toBeInTheDocument();
    view.unmount();
    render(view.element());
    await act(async () => {});
    expect(screen.queryByText(privateId)).not.toBeInTheDocument();
    expect(screen.getByText('Unauthorized Access')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
  test.each([401, 403, 404])(
    `${kind} hides cached detail after definitive HTTP %s and preserves its server error`,
    async status => {
      const view = cachedView();
      await screen.findByText(privateId);
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
          queryKey: [key, privateId],
        });
      });
      expect(
        await screen.findByText('Record no longer accessible')
      ).toBeInTheDocument();
      expect(screen.queryByText(privateId)).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /^Pay / })
      ).not.toBeInTheDocument();
    }
  );
  test(`${kind} retains valid owned cached detail after HTTP 503`, async () => {
    const view = cachedView();
    await screen.findByText(privateId);
    jest.mocked(fetch).mockResolvedValue({
      ...response({ success: false, error: 'Temporarily unavailable' }, false),
      status: 503,
    } as Response);
    await act(async () => {
      await view.client.invalidateQueries({
        queryKey: [key, privateId],
      });
    });
    expect(screen.getByText(privateId)).toBeInTheDocument();
    expect(screen.queryByText(/Not Found/)).not.toBeInTheDocument();
  });
}

for (const { kind, Page, key, noun } of cases) {
  test(`${kind} ignores a canceled request's denial after a newer authorized read`, async () => {
    const data = fixture({ kind, id: privateId });
    jest.mocked(fetch).mockResolvedValue({
      ...response({ success: true, data }),
      status: 200,
    } as Response);
    const view = setup(Page, privateId);
    await screen.findByText(privateId);

    let finishOlderRequest: (value: Response) => void = () => {};
    jest.mocked(fetch).mockReturnValueOnce(
      new Promise(resolve => {
        finishOlderRequest = resolve;
      })
    );
    await act(async () => {
      void view.client.invalidateQueries({
        queryKey: [key, privateId],
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
        queryKey: [key, privateId],
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
    expect(view.client.getQueryData([key, privateId])).toEqual(authorizedData);
    expect(screen.getByText('Fresh authorized details')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Pay / })).toBeInTheDocument();
  });

  describe.each([401, 403, 404])(`${kind} after HTTP %s`, status => {
    test.each(['network failure', 'HTTP 503'] as const)(
      'keeps denied detail and checkout hidden through a %s retry and remount until an authorized read succeeds',
      async failure => {
        const data = fixture({ kind, id: privateId });
        jest.mocked(fetch).mockResolvedValue({
          ...response({ success: true, data }),
          status: 200,
        } as Response);
        const view = setup(Page, privateId);
        await screen.findByText(privateId);
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
            queryKey: [key, privateId],
          });
        });
        expect(
          await screen.findByText('Record no longer accessible')
        ).toBeInTheDocument();
        expect(screen.queryByText(privateId)).not.toBeInTheDocument();
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
        expect(screen.queryByText(privateId)).not.toBeInTheDocument();
        expect(
          screen.queryByRole('button', { name: /^Pay / })
        ).not.toBeInTheDocument();
        const retryError =
          failure === 'network failure'
            ? `Failed to load ${noun}`
            : 'Temporarily unavailable';
        expect(await screen.findByText(retryError)).toBeInTheDocument();

        view.unmount();
        render(view.element(Promise.resolve({ id: privateId })));
        expect(await screen.findByText(retryError)).toBeInTheDocument();
        expect(screen.queryByText(privateId)).not.toBeInTheDocument();
        expect(
          screen.queryByRole('button', { name: /^Pay / })
        ).not.toBeInTheDocument();

        jest.mocked(fetch).mockResolvedValue({
          ...response({ success: true, data }),
          status: 200,
        } as Response);
        fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
        expect(await screen.findByText(privateId)).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: /^Pay / })
        ).toBeInTheDocument();
        expect(screen.queryByText(retryError)).not.toBeInTheDocument();
      }
    );
  });
}

for (const { kind, Page, key, noun } of cases) {
  test.each([null, 'not JSON'])(
    'clears cached ' + kind + ' detail on a malformed denial %j',
    async body => {
      const id = '507f1f77bcf86cd7994390aa';
      const data = fixture({ kind, id });
      jest
        .mocked(fetch)
        .mockResolvedValue(response({ success: true, data }) as Response);
      const view = setup(Page, id);
      await screen.findByText(id);
      jest.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => {
          if (body === 'not JSON') throw new SyntaxError();
          return body;
        },
      } as Response);
      await act(async () => {
        await view.client.invalidateQueries({ queryKey: [key, id] });
      });
      expect(view.client.getQueryData([key, id])).toBeNull();
      expect(view.client.getQueryState([key, id])?.error).toMatchObject({
        status: 403,
      });
    }
  );
  test.each([
    'different ID',
    'missing detail',
    'malformed detail',
    'nonliteral success',
  ])('rejects ' + kind + ' %s', async reason => {
    const id = '507f1f77bcf86cd7994390aa';
    const data = fixture({
      kind,
      id: reason === 'different ID' ? '507f1f77bcf86cd7994390bb' : id,
    });
    jest.mocked(fetch).mockResolvedValue(
      response({
        success: reason === 'nonliteral success' ? 1 : true,
        data:
          reason === 'missing detail'
            ? null
            : reason === 'malformed detail'
              ? { ...data, totalPrice: '1' }
              : data,
      }) as Response
    );
    const view = setup(Page, id);
    await screen.findByText('Failed to load ' + noun);
    expect(view.client.getQueryData([key, id])).toBeUndefined();
  });
}

const ResponseStream: typeof ReadableStream =
  runInThisContext('ReadableStream');
for (const { kind, Page, key } of cases) {
  test.each([401, 403, 404])(
    'hides ' + kind + ' on HTTP %s headers while a streamed denial is pending',
    async status => {
      const data = fixture({ kind, id: privateId });
      jest
        .mocked(fetch)
        .mockResolvedValue(FetchResponse.json({ success: true, data }));
      const view = setup(Page, privateId);
      await screen.findByText(privateId);
      const queryKey = [key, privateId];
      let finishBody: () => void = () => {
        throw new Error('Missing stream controller');
      };
      const stream = new ResponseStream<Uint8Array>({
        start(controller) {
          finishBody = () => {
            controller.enqueue(
              new TextEncoder().encode(
                JSON.stringify({
                  success: false,
                  error: 'Revoked during refresh',
                })
              )
            );
            controller.close();
          };
        },
      });
      const denial = new FetchResponse(stream, { status });
      jest.mocked(fetch).mockResolvedValueOnce(denial);
      let deniedRead: Promise<void> | undefined;
      await act(async () => {
        deniedRead = view.client.invalidateQueries({ queryKey });
      });
      await waitFor(() => expect(denial.bodyUsed).toBe(true));
      expect(view.client.getQueryData(queryKey)).toBeNull();
      await waitFor(() =>
        expect(screen.queryByText(privateId)).not.toBeInTheDocument()
      );
      expect(
        screen.queryByRole('button', { name: /^Pay / })
      ).not.toBeInTheDocument();
      if (status === 404) {
        mockUserId = 'new-owner';
        view.updateAuth();
        const newer = {
          ...data,
          customer: mockUserId,
          specialRequests: ['Newer authorized detail'],
        };
        jest
          .mocked(fetch)
          .mockResolvedValueOnce(
            FetchResponse.json({ success: true, data: newer })
          );
        await act(async () => {
          await view.client.invalidateQueries({ queryKey });
        });
        await screen.findByText('Newer authorized detail');
        await act(async () => {
          finishBody();
          await deniedRead;
        });
        expect(view.client.getQueryData(queryKey)).toEqual(newer);
        expect(screen.getByText('Newer authorized detail')).toBeInTheDocument();
      } else {
        await act(async () => {
          finishBody();
          await deniedRead;
        });
        expect(view.client.getQueryState(queryKey)?.error).toMatchObject({
          status,
          message: 'Revoked during refresh',
        });
        expect(
          await screen.findByText('Revoked during refresh')
        ).toBeInTheDocument();
      }
    }
  );
}
