import { ProviderContext } from '@heroui/system';
import userEvent from '@testing-library/user-event';
import {
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { parseDate } from '@internationalized/date';
import type { ReactNode } from 'react';
import DiningReservationForm from '@/components/DiningReservationForm';
import { useDiningAvailability } from '@/hooks/useDiningReservation';
import type { Dining } from '@/types';

const diningId = '507f1f77bcf86cd7994390ab';
const date = '2040-06-01';
const time = '17:00';
const day = {
  diningId,
  date,
  time: null,
  seatsRemaining: null,
  maxPeople: null,
  isAvailable: true,
  servingTime: { start: '17:00', end: '22:00' },
};
const dining: Dining = {
  _id: diningId,
  name: 'Dinner',
  description: 'Dinner',
  type: 'menu',
  mealType: 'dinner',
  category: 'regular',
  price: 25,
  image: '/dinner.jpg',
  maxPeople: 0,
  servingTime: day.servingTime,
};

jest.mock('@heroui/date-picker', () => ({
  DatePicker: ({
    onChange,
  }: {
    onChange: (date: ReturnType<typeof parseDate>) => void;
  }) => (
    <button type='button' onClick={() => onChange(parseDate('2040-06-01'))}>
      Pick dining date
    </button>
  ),
}));

const originalFetch = global.fetch;
const fetchMock = jest.fn<
  Promise<{ ok: boolean; status?: number; json: () => Promise<unknown> }>,
  Parameters<typeof fetch>
>();
let client: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function reply(body: unknown) {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => body,
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  Object.defineProperty(global, 'fetch', { value: fetchMock, writable: true });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  client.clear();
  global.fetch = originalFetch;
});

test('unlimited capacity with a null time stays available after selecting a day', async () => {
  const data = {
    ...day,
    diningId: diningId.toUpperCase(),
    servingTime: { ...day.servingTime, zone: 'UTC' },
    policy: 'unlimited',
  };
  reply({ success: true, data });
  render(
    <ProviderContext value={{ disableAnimation: true }}>
      <DiningReservationForm dining={dining} />
    </ProviderContext>,
    { wrapper }
  );
  expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Pick dining date' }));

  const key = ['dining-availability', diningId, date, undefined];
  await waitFor(() =>
    expect(client.getQueryState(key)?.status).toBe('success')
  );
  expect(client.getQueryData(key)).toEqual(data);
  expect(fetchMock).toHaveBeenCalledWith(
    `/api/dining/${diningId}/availability?date=2040-06-01`
  );
  reply({ success: true, data: { ...data, time } });
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /Select Time/ }));
  await user.click(await screen.findByRole('option', { name: time }));
  expect(await screen.findByText('Available')).toBeVisible();
  expect(
    client.getQueryData(['dining-availability', diningId, date, time])
  ).toEqual({ ...data, time });
  expect(screen.getByRole('button', { name: 'Reserve Now' })).toBeEnabled();
});

test('caches the server’s outside-hours result for the requested time', async () => {
  const outside = '12:00';
  const data = {
    ...day,
    time: outside,
    seatsRemaining: 0,
    maxPeople: 32,
    isAvailable: false,
    reason: 'Outside serving hours',
  };
  reply({ success: true, data });
  const { result } = renderHook(
    () => useDiningAvailability({ diningId, date, time: outside }),
    { wrapper }
  );

  await waitFor(() => expect(result.current.data).toEqual(data));
  expect(
    client.getQueryData(['dining-availability', diningId, date, outside])
  ).toEqual(data);
  expect(fetchMock).toHaveBeenCalledWith(
    `/api/dining/${diningId}/availability?date=2040-06-01&time=12%3A00`
  );
});

const timed = { ...day, time };
test.each([
  ['an error-only response', { error: 'Unavailable' }],
  ['false success with otherwise valid data', { success: false, data: timed }],
  ['a truthy marker', { success: 'true', data: timed }],
  ['a missing data payload', { success: true }],
  [
    'incorrectly typed capacity',
    { success: true, data: { ...timed, seatsRemaining: '4' } },
  ],
  [
    'a different dining ID',
    { success: true, data: { ...timed, diningId: '507f1f77bcf86cd7994390ac' } },
  ],
  [
    'a different day',
    { success: true, data: { ...timed, date: '2040-06-02' } },
  ],
  ['a different time', { success: true, data: { ...timed, time: '18:00' } }],
  ['null instead of the requested time', { success: true, data: day }],
])(
  'treats %s as a query error without caching an availability value',
  async (_name, body) => {
    reply(body);
    const { result } = renderHook(
      () => useDiningAvailability({ diningId, date, time }),
      { wrapper }
    );

    const key = ['dining-availability', diningId, date, time];
    await waitFor(() =>
      expect(client.getQueryState(key)?.status).toBe('error')
    );
    expect(result.current.data).toBeUndefined();
    expect(client.getQueryData(key)).toBeUndefined();
  }
);
