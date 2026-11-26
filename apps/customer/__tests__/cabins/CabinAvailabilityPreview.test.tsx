import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CabinAvailabilityPreview from '@/components/CabinAvailabilityPreview';

const cabinId = '507f1f77bcf86cd7994390ab';
const key = ['cabin-availability', cabinId];
const calendar = {
  cabinId,
  unavailableDates: [],
  queryRange: { start: '2026-12-01', end: '2027-06-01' },
};
const originalFetch = global.fetch;
const fetchMock = jest.fn<
  Promise<{ ok: boolean; status?: number; json: () => Promise<unknown> }>,
  Parameters<typeof fetch>
>();
let client: QueryClient;

function renderPreview() {
  return render(
    <QueryClientProvider client={client}>
      <CabinAvailabilityPreview cabinId={cabinId} />
    </QueryClientProvider>
  );
}

function reply(body: unknown, status = 200) {
  fetchMock.mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  Object.defineProperty(global, 'fetch', { value: fetchMock, writable: true });
  jest.useFakeTimers({ now: new Date(2026, 11, 10, 12) });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  client.clear();
  jest.useRealTimers();
  global.fetch = originalFetch;
});

test('renders the skeleton before availability resolves', () => {
  fetchMock.mockReturnValue(new Promise(() => {}));
  renderPreview();
  expect(screen.getByTestId('availability-skeleton')).toBeInTheDocument();
});

test('caches a valid empty availability response with its original ID and additive fields', async () => {
  const data = {
    ...calendar,
    cabinId: cabinId.toUpperCase(),
    queryRange: { ...calendar.queryRange, zone: 'UTC' },
    calendarVersion: 1,
  };
  reply({ success: true, data });
  renderPreview();

  expect(await screen.findByText('Available')).toBeInTheDocument();
  expect(screen.getByText('Booked')).toBeInTheDocument();
  expect(screen.getByText('December 2026')).toBeInTheDocument();
  expect(screen.getByText('January 2027')).toBeInTheDocument();
  expect(client.getQueryData(key)).toEqual(data);
  expect(fetchMock).toHaveBeenCalledWith(`/api/cabins/${cabinId}/availability`);
});

test.each([
  ['2030-06-01', '+010000-06-01'],
  ['-002100-01-01', '2026-12-13'],
])(
  'handles half-open UTC dates in a response with signed years from %s to %s',
  async (start, end) => {
    const data = {
      ...calendar,
      unavailableDates: [
        { start, end, bookingKind: 'cabin' },
        { start: '2026-12-15', end: '2026-12-17' },
      ],
      queryRange: { start: '-002101-01-01', end: '+010010-01-01' },
    };
    reply({ success: true, data });
    renderPreview();

    const month = (await screen.findByText('December 2026')).parentElement;
    if (!month) throw new Error('Missing December calendar');
    expect(within(month).getByText('12')).toHaveClass(
      start.startsWith('-') ? 'bg-danger-100' : 'bg-success-100'
    );
    expect(within(month).getByText('13')).toHaveClass('bg-success-100');
    expect(within(month).getByText('15')).toHaveClass('bg-danger-100');
    expect(within(month).getByText('16')).toHaveClass('bg-danger-100');
    expect(within(month).getByText('17')).toHaveClass('bg-success-100');
    expect(client.getQueryData(key)).toEqual(data);
  }
);

test.each([
  ['error-only JSON', { error: 'Temporarily unavailable' }, 200],
  ['truthy success marker', { success: 'true', data: calendar }, 200],
  [
    'an HTTP error carrying a success body',
    { success: true, data: calendar },
    503,
  ],
  [
    'a response for a different cabin',
    {
      success: true,
      data: { ...calendar, cabinId: '507f1f77bcf86cd7994390ac' },
    },
    200,
  ],
  [
    'an invalid range array',
    { success: true, data: { ...calendar, unavailableDates: {} } },
    200,
  ],
  [
    'an absent unavailable range field',
    { success: true, data: { cabinId, queryRange: calendar.queryRange } },
    200,
  ],
  [
    'an impossible date',
    {
      success: true,
      data: {
        ...calendar,
        queryRange: { start: '2026-02-30', end: '2027-06-01' },
      },
    },
    200,
  ],
  [
    'a reversed range',
    {
      success: true,
      data: {
        ...calendar,
        unavailableDates: [{ start: '2026-12-15', end: '2026-12-14' }],
      },
    },
    200,
  ],
])(
  'renders the availability error for %s without populating the cache',
  async (_name, body, status) => {
    reply(body, status);
    renderPreview();

    await waitFor(() =>
      expect(client.getQueryState(key)?.status).toBe('error')
    );
    expect(
      await screen.findByText(/unable to load availability/i)
    ).toBeInTheDocument();
    expect(screen.queryByText('Available')).not.toBeInTheDocument();
    expect(client.getQueryData(key)).toBeUndefined();
  }
);
