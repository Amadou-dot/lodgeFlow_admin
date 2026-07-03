import {
  formatBookingDates,
  getStatusColor,
  getStatusLabel,
} from '@/utils/bookingUtils';

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
    beforeAll(() => {
      jest.useFakeTimers().setSystemTime(new Date('2026-07-03T12:00:00Z'));
    });

    afterAll(() => {
      jest.useRealTimers();
    });

    it('formats the date range', () => {
      const { dateRange } = formatBookingDates(
        '2026-07-10T12:00:00Z',
        '2026-07-15T12:00:00Z',
        5,
        'confirmed'
      );
      expect(dateRange).toBe('Jul 10, 2026 — Jul 15, 2026');
    });

    it('shows time-until-check-in for future confirmed bookings', () => {
      const { timeInfo, showTimeInfo } = formatBookingDates(
        '2026-07-10T12:00:00Z',
        '2026-07-15T12:00:00Z',
        5,
        'confirmed'
      );
      expect(showTimeInfo).toBe(true);
      expect(timeInfo).toBe('7 days → 5 nights stay');
    });

    it('shows overdue info for past unconfirmed check-ins', () => {
      const { timeInfo } = formatBookingDates(
        '2026-07-01T12:00:00Z',
        '2026-07-05T12:00:00Z',
        4,
        'unconfirmed'
      );
      expect(timeInfo).toBe('2 days ago → 4 nights stay');
    });

    it('shows time since check-in for checked-in bookings', () => {
      const { timeInfo } = formatBookingDates(
        '2026-07-02T12:00:00Z',
        '2026-07-08T12:00:00Z',
        6,
        'checked-in'
      );
      expect(timeInfo).toBe('1 day ago → 6 nights stay');
    });

    it('shows time since check-out for checked-out bookings', () => {
      const { timeInfo } = formatBookingDates(
        '2026-06-20T12:00:00Z',
        '2026-06-26T12:00:00Z',
        6,
        'checked-out'
      );
      expect(timeInfo).toBe('7 days ago → 6 nights stay');
    });

    it('uses singular "night" for one-night stays', () => {
      const { timeInfo } = formatBookingDates(
        '2026-07-10T12:00:00Z',
        '2026-07-11T12:00:00Z',
        1,
        'confirmed'
      );
      expect(timeInfo).toContain('1 night stay');
      expect(timeInfo).not.toContain('nights');
    });

    it('hides time info for cancelled bookings', () => {
      const { timeInfo, showTimeInfo } = formatBookingDates(
        '2026-07-10T12:00:00Z',
        '2026-07-15T12:00:00Z',
        5,
        'cancelled'
      );
      expect(showTimeInfo).toBe(false);
      expect(timeInfo).toBe('');
    });
  });
});
