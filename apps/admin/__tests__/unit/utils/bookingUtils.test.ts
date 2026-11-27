import { formatBookingStayDate } from '@/lib/booking-stay-date';
import {
  formatBookingDates,
  getStatusColor,
  getStatusLabel,
} from '@/utils/bookingUtils';

test.each(['short', 'long-weekday'] as const)(
  'the %s stay-date style retains the capitalized malformed-date fallback',
  style => {
    expect(formatBookingStayDate({ date: 'bad-date', style })).toBe(
      'Invalid Date'
    );
  }
);

describe('bookingUtils', () => {
  describe('getStatusColor', () => {
    it.each([
      ['unconfirmed', 'warning'],
      ['confirmed', 'primary'],
      ['checked-in', 'success'],
      ['checked-out', 'default'],
      ['cancelled', 'danger'],
    ])('maps %s to %s', (status, color) => {
      expect(getStatusColor(status)).toBe(color);
    });

    it('falls back to default for unknown statuses', () => {
      expect(getStatusColor('bogus')).toBe('default');
    });
  });

  describe('getStatusLabel', () => {
    it.each([
      ['unconfirmed', 'Unconfirmed'],
      ['confirmed', 'Confirmed'],
      ['checked-in', 'Checked In'],
      ['checked-out', 'Checked Out'],
      ['cancelled', 'Cancelled'],
    ])('maps %s to %s', (status, label) => {
      expect(getStatusLabel(status)).toBe(label);
    });

    it('returns the raw status for unknown values', () => {
      expect(getStatusLabel('bogus')).toBe('bogus');
    });
  });

  describe('formatBookingDates', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date('2026-07-03T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('renders UTC-midnight labels with the existing relative wording and night count', () => {
      jest.setSystemTime(new Date('2027-03-19T12:00:00.000Z'));
      expect(
        formatBookingDates({
          checkIn: '2027-03-20T00:00:00.000Z',
          checkOut: '2027-03-23T00:00:00.000Z',
          numNights: 3,
          status: 'confirmed',
        })
      ).toEqual({
        dateRange: 'Mar 20, 2027 — Mar 23, 2027',
        timeInfo: 'about 12 hours → 3 nights stay',
        showTimeInfo: true,
      });
    });

    it('renders non-midnight legacy instants on their UTC days across a year boundary', () => {
      const { dateRange } = formatBookingDates({
        checkIn: '2026-12-31T23:30:00.000Z',
        checkOut: '2027-01-01T23:30:00.000Z',
        numNights: 1,
        status: 'cancelled',
      });
      expect(dateRange).toBe('Dec 31, 2026 — Jan 01, 2027');
    });

    it('preserves the list formatter error for malformed stay dates', () => {
      expect(() =>
        formatBookingDates({
          checkIn: 'bad-date',
          checkOut: '2027-03-23T00:00:00.000Z',
          numNights: 3,
          status: 'cancelled',
        })
      ).toThrow(RangeError);
    });

    it('formats the date range', () => {
      const { dateRange } = formatBookingDates({
        checkIn: '2026-07-10T12:00:00Z',
        checkOut: '2026-07-15T12:00:00Z',
        numNights: 5,
        status: 'confirmed',
      });
      expect(dateRange).toBe('Jul 10, 2026 — Jul 15, 2026');
    });

    it('shows time-until-check-in for future confirmed bookings', () => {
      const { timeInfo, showTimeInfo } = formatBookingDates({
        checkIn: '2026-07-10T12:00:00Z',
        checkOut: '2026-07-15T12:00:00Z',
        numNights: 5,
        status: 'confirmed',
      });
      expect(showTimeInfo).toBe(true);
      expect(timeInfo).toBe('7 days → 5 nights stay');
    });

    it('shows overdue info for past unconfirmed check-ins', () => {
      const { timeInfo } = formatBookingDates({
        checkIn: '2026-07-01T12:00:00Z',
        checkOut: '2026-07-05T12:00:00Z',
        numNights: 4,
        status: 'unconfirmed',
      });
      expect(timeInfo).toBe('2 days ago → 4 nights stay');
    });

    it('shows time since check-in for checked-in bookings', () => {
      const { timeInfo } = formatBookingDates({
        checkIn: '2026-07-02T12:00:00Z',
        checkOut: '2026-07-08T12:00:00Z',
        numNights: 6,
        status: 'checked-in',
      });
      expect(timeInfo).toBe('1 day ago → 6 nights stay');
    });

    it('shows time since check-out for checked-out bookings', () => {
      const { timeInfo } = formatBookingDates({
        checkIn: '2026-06-20T12:00:00Z',
        checkOut: '2026-06-26T12:00:00Z',
        numNights: 6,
        status: 'checked-out',
      });
      expect(timeInfo).toBe('7 days ago → 6 nights stay');
    });

    it('uses singular "night" for one-night stays', () => {
      const { timeInfo } = formatBookingDates({
        checkIn: '2026-07-10T12:00:00Z',
        checkOut: '2026-07-11T12:00:00Z',
        numNights: 1,
        status: 'confirmed',
      });
      expect(timeInfo).toContain('1 night stay');
      expect(timeInfo).not.toContain('nights');
    });

    it('hides time info for cancelled bookings', () => {
      const { timeInfo, showTimeInfo } = formatBookingDates({
        checkIn: '2026-07-10T12:00:00Z',
        checkOut: '2026-07-15T12:00:00Z',
        numNights: 5,
        status: 'cancelled',
      });
      expect(showTimeInfo).toBe(false);
      expect(timeInfo).toBe('');
    });
  });
});
