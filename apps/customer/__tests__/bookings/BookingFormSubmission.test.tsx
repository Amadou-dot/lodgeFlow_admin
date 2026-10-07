import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { parseDate, type CalendarDate } from '@internationalized/date';
import type { RangeValue } from '@react-types/shared';
import BookingForm from '@/components/BookingForm';
import type { CreateBookingRequest } from '@/lib/validations/booking';

const mockCreateBooking = jest.fn();
jest.mock('@/hooks/useBooking', () => ({
  useCreateBooking: () => ({ mutate: mockCreateBooking }),
}));
jest.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({
    data: {
      breakfastPrice: 15,
      petFee: 10,
      parkingFee: 5,
      earlyCheckInFee: 25,
      lateCheckOutFee: 30,
      parkingIncluded: false,
      allowPets: true,
    },
  }),
}));
jest.mock('swr', () => ({
  __esModule: true,
  default: () => ({ data: undefined }),
}));
// Supply a calendar selection; keep the real form, select, checkbox and textarea.
jest.mock('@heroui/date-picker', () => ({
  DateRangePicker: ({
    onChange,
  }: {
    onChange: (value: RangeValue<CalendarDate>) => void;
  }) => (
    <button
      type='button'
      onClick={() =>
        onChange({
          start: parseDate('2030-01-10'),
          end: parseDate('2030-01-13'),
        })
      }
    >
      Select stay dates
    </button>
  ),
}));

const cabin = {
  _id: '507f1f77bcf86cd799439011',
  name: 'Forest Edge Cabin',
  regularPrice: 180,
  maxCapacity: 4,
  extraGuestFee: 20,
};
const userData = {
  firstName: 'Test',
  lastName: 'Guest',
  email: 'guest@example.com',
  phone: '1234567890',
};
const extraLabels = [
  /add breakfast/,
  /bringing a pet/,
  /need parking/,
  /check-in early/,
  /check-out late/,
];

async function selectStay(guests = 2) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Select stay dates' }));
  // HeroUI's native select forwards changes to the same controlled selection.
  const select = screen
    .getByRole('form', { name: 'Cabin booking form' })
    .querySelector('select');
  if (!select) throw new Error('Missing guest select');
  fireEvent.change(select, { target: { value: String(guests) } });
  return user;
}

async function submit() {
  fireEvent.submit(screen.getByRole('form', { name: 'Cabin booking form' }));
  await waitFor(() => expect(mockCreateBooking).toHaveBeenCalledTimes(1));
}

beforeEach(() => mockCreateBooking.mockReset());

it('submits every selected HeroUI extra and preserves ISO stay dates', async () => {
  render(<BookingForm cabin={cabin} userData={userData} />);
  const user = await selectStay();
  for (const name of extraLabels) {
    await user.click(screen.getByRole('checkbox', { name }));
  }
  await submit();
  expect(mockCreateBooking).toHaveBeenCalledWith(
    {
      cabinId: cabin._id,
      checkInDate: '2030-01-10T00:00:00.000Z',
      checkOutDate: '2030-01-13T00:00:00.000Z',
      numGuests: 2,
      extras: {
        hasBreakfast: true,
        hasPets: true,
        hasParking: true,
        hasEarlyCheckIn: true,
        hasLateCheckOut: true,
      },
      specialRequests: [],
      observations: '',
    } satisfies CreateBookingRequest,
    expect.any(Object)
  );
});

it('submits false after each selected extra is toggled off', async () => {
  render(<BookingForm cabin={cabin} userData={userData} />);
  const user = await selectStay();
  for (const name of extraLabels) {
    const checkbox = screen.getByRole('checkbox', { name });
    await user.click(checkbox);
    await user.click(checkbox);
  }
  await submit();
  expect(mockCreateBooking).toHaveBeenCalledWith(
    expect.objectContaining({
      extras: {
        hasBreakfast: false,
        hasPets: false,
        hasParking: false,
        hasEarlyCheckIn: false,
        hasLateCheckOut: false,
      },
    }),
    expect.any(Object)
  );
});

it.each(['\n', '\r\n'])(
  'preserves whole request lines separated by %j',
  async newline => {
    render(<BookingForm cabin={cabin} userData={userData} />);
    await selectStay();
    fireEvent.change(
      screen.getByRole('textbox', { name: /Special Requests/ }),
      {
        target: {
          value: `  Quiet room  ${newline} ${newline} Late arrival ${newline}`,
        },
      }
    );
    await submit();
    expect(mockCreateBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        specialRequests: ['Quiet room', 'Late arrival'],
      }),
      expect.any(Object)
    );
  }
);

it.each([
  { guests: 1, fee: 20, discount: 0, total: '$540', extra: null },
  { guests: 2, fee: 20, discount: 0, total: '$600', extra: '+$60' },
  { guests: 3, fee: 20, discount: 30, total: '$570', extra: '+$120' },
  { guests: 2, fee: undefined, discount: 0, total: '$540', extra: null },
])(
  'quotes $guests guests with fee $fee and discount $discount',
  async ({ guests, fee, discount, total, extra }) => {
    const bookingCabin = { ...cabin, extraGuestFee: fee, discount };
    render(<BookingForm cabin={bookingCabin} userData={userData} />);
    await selectStay(guests);
    expect(
      screen.getByText('Total (before taxes)').parentElement
    ).toHaveTextContent(total);
    if (extra) {
      expect(screen.getByText('Extra guests').parentElement).toHaveTextContent(
        extra
      );
    } else {
      expect(screen.queryByText('Extra guests')).not.toBeInTheDocument();
    }
  }
);
