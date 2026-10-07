import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { DateRangePickerProps } from '@heroui/date-picker';
import type { CalendarDate } from '@internationalized/date';
import { SWRConfig } from 'swr';
import BookingDatesGuests from '@/components/BookingForm/BookingDatesGuests';
import type { BookingFormData } from '@/components/BookingForm/types';
import type { Cabin } from '@/types';

jest.unmock('swr');
jest.mock('@heroui/date-picker', () => {
  const { parseDate } = jest.requireActual<
    typeof import('@internationalized/date')
  >('@internationalized/date');
  return {
    DateRangePicker: ({
      value,
      onChange,
      isDisabled,
      isDateUnavailable,
      errorMessage,
    }: DateRangePickerProps<CalendarDate>) => (
      <div>
        <output aria-label='Selected start'>{value?.start.toString()}</output>
        <output aria-label='Selected end'>{value?.end.toString()}</output>
        <output aria-label='June 3'>
          {isDateUnavailable?.(parseDate('2040-06-03'))
            ? 'unavailable'
            : 'available'}
        </output>
        <output aria-label='June 4'>
          {isDateUnavailable?.(parseDate('2040-06-04'))
            ? 'unavailable'
            : 'available'}
        </output>
        <output aria-label='June 5'>
          {isDateUnavailable?.(parseDate('2040-06-05'))
            ? 'unavailable'
            : 'available'}
        </output>
        <button
          disabled={isDisabled}
          onClick={() =>
            onChange?.({
              start: parseDate('2040-06-07'),
              end: parseDate('2040-06-09'),
            })
          }
        >
          Choose stay
        </button>
        <button disabled={isDisabled} onClick={() => onChange?.(null)}>
          Clear stay
        </button>
        {typeof errorMessage === 'string' && (
          <span role='alert'>{errorMessage}</span>
        )}
      </div>
    ),
  };
});

const fetchMock = jest.fn();
const originalFetch = global.fetch;
const cabin: Cabin = {
  _id: '507f1f77bcf86cd799439011',
  id: '507f1f77bcf86cd799439011',
  name: 'Pine',
  image: 'https://example.invalid/pine.jpg',
  images: [],
  capacity: 4,
  price: 200,
  discount: 0,
  description: 'A quiet forest retreat',
  amenities: [],
  status: 'active',
};
const formData: BookingFormData = {
  cabin: cabin._id,
  customer: 'user_guest',
  checkInDate: '2040-06-01',
  checkOutDate: '2040-06-03',
  numGuests: 2,
  hasBreakfast: false,
  hasPets: false,
  hasParking: false,
  hasEarlyCheckIn: false,
  hasLateCheckOut: false,
  observations: '',
  specialRequests: [],
  paymentMethod: 'cash',
  isPaid: false,
  depositPaid: false,
};
const available = {
  success: true,
  data: {
    cabinId: cabin._id,
    unavailableDates: [{ start: '2040-06-03', end: '2040-06-05' }],
    queryRange: { start: '2040-06-01', end: '2040-12-01' },
  },
};
function response({ body, ok = true }: { body: unknown; ok?: boolean }) {
  return { ok, json: async () => body } satisfies Pick<Response, 'ok' | 'json'>;
}
function show({
  includeCabin = true,
  excludeBookingId,
}: { includeCabin?: boolean; excludeBookingId?: string } = {}) {
  const changed = jest.fn<
    void,
    [keyof BookingFormData, BookingFormData[keyof BookingFormData]]
  >();
  render(
    <SWRConfig
      value={{
        provider: () => new Map(),
        dedupingInterval: 0,
        shouldRetryOnError: false,
        revalidateOnFocus: false,
      }}
    >
      <BookingDatesGuests
        formData={formData}
        onInputChange={changed}
        selectedCabin={includeCabin ? cabin : undefined}
        numNights={2}
        excludeBookingId={excludeBookingId}
        maxGuestsPerBooking={3}
      />
    </SWRConfig>
  );
  return changed;
}
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(response({ body: available }));
  global.fetch = fetchMock;
});
afterEach(() => {
  global.fetch = originalFetch;
});

describe('booking calendar characterization', () => {
  test('requests the selected cabin/exclusion and keeps checkout day selectable', async () => {
    const excluded = '507f1f77bcf86cd799439012';
    show({ excludeBookingId: excluded });
    await waitFor(() =>
      expect(screen.getByLabelText('June 3')).toHaveTextContent('unavailable')
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/cabins/${cabin.id}/availability?excludeBookingId=${excluded}`
    );
    expect(screen.getByLabelText('June 4')).toHaveTextContent('unavailable');
    expect(screen.getByLabelText('June 5')).toHaveTextContent(/^available$/);
    expect(screen.getByLabelText('Selected start')).toHaveTextContent(
      '2040-06-01'
    );
    expect(screen.getByLabelText('Selected end')).toHaveTextContent(
      '2040-06-03'
    );
  });
  test('keeps date-only change/clear inputs and guest limit', async () => {
    const changed = show();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Choose stay' }));
    expect(changed.mock.calls).toEqual([
      ['checkInDate', '2040-06-07'],
      ['checkOutDate', '2040-06-09'],
    ]);
    changed.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Clear stay' }));
    expect(changed.mock.calls).toEqual([
      ['checkInDate', ''],
      ['checkOutDate', ''],
    ]);
    expect(screen.getByLabelText('Number of Guests')).toHaveAttribute(
      'max',
      '3'
    );
  });
  test('does not fetch or enable date selection without a cabin', () => {
    show({ includeCabin: false });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Choose stay' })).toBeDisabled();
  });
  test('shows empty availability information', async () => {
    fetchMock.mockResolvedValue(
      response({
        body: {
          ...available,
          data: { ...available.data, unavailableDates: [] },
        },
      })
    );
    show();
    expect(
      await screen.findByText(
        'All dates in the next 6 months are available for booking.'
      )
    ).toBeInTheDocument();
  });
  test('reports network failure', async () => {
    fetchMock.mockRejectedValue(new Error('Network failure'));
    show();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Failed to load availability data'
    );
  });
});

describe('booking calendar regressions', () => {
  test.each([
    {
      ok: false,
      body: { success: false, error: 'Failed to fetch cabin availability' },
    },
    {
      ok: true,
      body: {
        success: true,
        data: {
          ...available.data,
          unavailableDates: [{ start: 'bad', end: '2040-06-05' }],
        },
      },
    },
    { ok: true, body: { success: true, data: { cabinId: cabin.id } } },
  ])(
    'reports HTTP or invalid response failure before date rendering: %j',
    async input => {
      fetchMock.mockResolvedValue(response(input));
      show();
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Failed to load availability data'
      );
      expect(screen.getByLabelText('June 3')).toHaveTextContent(/^available$/);
      expect(
        screen.queryByText(
          'All dates in the next 6 months are available for booking.'
        )
      ).not.toBeInTheDocument();
    }
  );
});
