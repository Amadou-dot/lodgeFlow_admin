import { render, screen, waitFor } from '@testing-library/react';
import { parseDate, type DateValue } from '@internationalized/date';
import { SWRConfig } from 'swr';
import BookingForm from '@/components/BookingForm';
import { useCreateBooking } from '@/hooks/useBooking';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

jest.mock('@/hooks/useBooking');
jest.mock('@/hooks/useIsMobile');
jest.mock('@/hooks/useSettings', () => ({
  useSettings: jest.fn(() => ({
    data: undefined,
    isLoading: false,
    error: null,
  })),
}));
jest.mock('@clerk/nextjs');
jest.mock('next/navigation', () => ({ useRouter: jest.fn() }));
interface PickerProps {
  calendarWidth?: number;
  visibleMonths?: number;
  description?: string;
  errorMessage?: string;
  isDateUnavailable?: (date: DateValue) => boolean;
}

let capturedProps: PickerProps = {};
jest.mock('@heroui/date-picker', () => ({
  DateRangePicker: (props: PickerProps) => {
    capturedProps = props;
    return <p>{props.description}</p>;
  },
}));

const mockCabin = {
  _id: '507f1f77bcf86cd7994390ab',
  name: 'Test Cabin',
  regularPrice: 200,
  maxCapacity: 4,
};
const availabilityUrl = `/api/cabins/${mockCabin._id}/availability`;
const calendar = {
  cabinId: mockCabin._id,
  unavailableDates: [],
  queryRange: { start: '2030-01-01', end: '2030-07-01' },
};
const originalFetch = global.fetch;
const fetchMock = jest.fn<
  Promise<{ ok: boolean; status?: number; json: () => Promise<unknown> }>,
  Parameters<typeof fetch>
>();

function reply(body: unknown, status = 200) {
  fetchMock.mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

function renderBookingForm() {
  const cache = new Map<string, { data?: unknown }>();
  render(
    <SWRConfig value={{ provider: () => cache, shouldRetryOnError: false }}>
      <BookingForm cabin={mockCabin} />
    </SWRConfig>
  );
  return cache;
}

const mockUser = {
  id: 'u1',
  firstName: 'John',
  lastName: 'Doe',
  emailAddresses: [{ emailAddress: 'j@example.com' }],
  phoneNumbers: [{ phoneNumber: '123' }],
};

beforeEach(() => {
  capturedProps = {};
  fetchMock.mockReset();
  Object.defineProperty(global, 'fetch', { value: fetchMock, writable: true });
  fetchMock.mockReturnValue(new Promise(() => {}));
  (useUser as jest.Mock).mockReturnValue({
    isSignedIn: true,
    isLoaded: true,
    user: mockUser,
  });
  (useCreateBooking as jest.Mock).mockReturnValue({ mutate: jest.fn() });
  (useRouter as jest.Mock).mockReturnValue({ push: jest.fn() });
});

describe('BookingForm - responsive DateRangePicker', () => {
  it('uses visibleMonths=1 on mobile', () => {
    (useIsMobile as jest.Mock).mockReturnValue(true);
    renderBookingForm();
    expect(capturedProps.visibleMonths).toBe(1);
  });

  it('uses visibleMonths=2 on desktop', () => {
    (useIsMobile as jest.Mock).mockReturnValue(false);
    renderBookingForm();
    expect(capturedProps.visibleMonths).toBe(2);
  });

  it('omits calendarWidth on mobile', () => {
    (useIsMobile as jest.Mock).mockReturnValue(true);
    renderBookingForm();
    expect(capturedProps.calendarWidth).toBeUndefined();
  });

  it('uses calendarWidth=400 on desktop', () => {
    (useIsMobile as jest.Mock).mockReturnValue(false);
    renderBookingForm();
    expect(capturedProps.calendarWidth).toBe(400);
  });
});

test('the booking form shows all dates available for a validated empty array', async () => {
  const data = {
    ...calendar,
    cabinId: mockCabin._id.toUpperCase(),
    queryRange: { ...calendar.queryRange, extra: true },
  };
  const body = { success: true, data, version: 1 };
  reply(body);
  const cache = renderBookingForm();

  expect(
    await screen.findByText(/all dates in the next 6 months/i)
  ).toBeInTheDocument();
  expect(cache.get(availabilityUrl)?.data).toEqual(body);
  expect(fetchMock).toHaveBeenCalledWith(availabilityUrl);
});

test('keeps checkout selectable with ordinary and signed-year dates', async () => {
  reply({
    success: true,
    data: {
      ...calendar,
      unavailableDates: [
        { start: '-000001-01-01', end: '2030-02-01' },
        { start: '2030-06-13', end: '2030-06-15' },
        { start: '2030-06-17', end: '2030-06-17' },
        { start: '2030-06-18', end: '+010000-06-01' },
      ],
    },
  });
  renderBookingForm();

  expect(await screen.findByText(/cannot be selected/i)).toBeInTheDocument();
  const isUnavailable = capturedProps.isDateUnavailable;
  expect(isUnavailable?.(parseDate('2030-01-31'))).toBe(true);
  expect(isUnavailable?.(parseDate('2030-02-01'))).toBe(false);
  expect(isUnavailable?.(parseDate('2030-06-14'))).toBe(true);
  expect(isUnavailable?.(parseDate('2030-06-15'))).toBe(false);
  expect(isUnavailable?.(parseDate('2030-06-17'))).toBe(false);
  expect(isUnavailable?.(parseDate('2030-06-19'))).toBe(true);
});

test.each([
  ['error-only JSON', { error: 'Temporarily unavailable' }, 200],
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
    'an invalid range date',
    {
      success: true,
      data: {
        ...calendar,
        queryRange: { ...calendar.queryRange, end: '2030-07-01T00:00:00.000Z' },
      },
    },
    200,
  ],
])(
  'the booking form reports %s without caching it as availability',
  async (_name, body, status) => {
    reply(body, status);
    const cache = renderBookingForm();

    await waitFor(() =>
      expect(cache.get(availabilityUrl)?.data).toBeUndefined()
    );
    expect(
      await screen.findByText('Failed to load availability data')
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/all dates in the next 6 months/i)
    ).not.toBeInTheDocument();
  }
);
