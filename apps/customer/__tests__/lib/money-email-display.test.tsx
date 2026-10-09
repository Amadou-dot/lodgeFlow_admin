/** @jest-environment node */
import { renderToStaticMarkup } from 'react-dom/server';
import {
  BookingConfirmationEmail,
  DiningReservationConfirmationEmail,
  ExperienceBookingConfirmationEmail,
} from '@/components/EmailTemplates';

const cabinBooking = {
  _id: '507f1f77bcf86cd799439011',
  checkInDate: '2040-01-01T00:00:00.000Z',
  checkOutDate: '2040-01-04T00:00:00.000Z',
  numNights: 3,
  numGuests: 2,
  cabinSubtotal: 1234.5,
  extrasPrice: 1.005,
  totalPrice: 1235.505,
  depositAmount: 300,
  remainingAmount: 935.505,
  extras: {
    hasBreakfast: false,
    breakfastPrice: 0,
    hasPets: false,
    petFee: 0,
    hasParking: false,
    parkingFee: 0,
    hasEarlyCheckIn: false,
    earlyCheckInFee: 0,
    hasLateCheckOut: false,
    lateCheckOutFee: 0,
  },
};

test('cabin confirmation retains USD grouping, subtotal and Intl rounding of fractional prices', () => {
  const text = renderToStaticMarkup(
    <BookingConfirmationEmail
      bookingData={cabinBooking}
      firstName='Avery'
      cabinData={{
        name: 'Pine',
        price: 9999,
        capacity: 4,
        description: '',
        amenities: [],
      }}
    />
  ).replace(/<[^>]+>/g, '');
  expect(text).toContain('$1,234.50');
  expect(text).toContain('Extras Subtotal:$1.01');
  expect(text).toContain('Total:$1,235.51');
  expect(text).toContain('Remaining Balance:$935.51');
});

test('reservation confirmations retain grouped USD totals and fractional catalog prices', () => {
  const dining = renderToStaticMarkup(
    <DiningReservationConfirmationEmail
      date='2040-01-01'
      firstName='Avery'
      numGuests={2}
      reservationId='reservation'
      time='19:00'
      totalPrice={1234.5}
      diningData={{
        name: 'Supper',
        price: 1.005,
        mealType: 'dinner',
        servingTime: { start: '18:00', end: '21:00' },
      }}
    />
  );
  const experience = renderToStaticMarkup(
    <ExperienceBookingConfirmationEmail
      bookingId='booking'
      date='2040-01-01'
      firstName='Avery'
      numParticipants={2}
      totalPrice={1234.5}
      experienceData={{
        name: 'Walk',
        price: 1.005,
        duration: '1 hour',
        includes: [],
        whatToBring: [],
      }}
    />
  );
  for (const rendered of [dining, experience]) {
    expect(rendered).toContain('$1.01');
    expect(rendered).toContain('$1,234.50');
  }
});

test('invalid money cannot render a confirmation with an infinite total', () => {
  expect(() =>
    renderToStaticMarkup(
      <BookingConfirmationEmail
        bookingData={{ ...cabinBooking, totalPrice: Infinity }}
        firstName='Avery'
        cabinData={{
          name: 'Pine',
          price: 100,
          capacity: 4,
          description: '',
          amenities: [],
        }}
      />
    )
  ).toThrow();
});
