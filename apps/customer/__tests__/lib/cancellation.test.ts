import {
  calculateRefund,
  getCancellationDeadlines,
  formatCancellationPolicy,
} from '@/lib/cancellation';
import type { IBooking } from '@/models/Booking';
import type { ISettings } from '@/models/Settings';

// Helper to create mock booking
function createMockBooking(overrides: Partial<IBooking> = {}): IBooking {
  return {
    _id: 'booking123',
    cabin: 'cabin123',
    customer: 'user123',
    checkInDate: new Date('2026-02-15'),
    checkOutDate: new Date('2026-02-18'),
    numNights: 3,
    numGuests: 2,
    status: 'confirmed',
    cabinPrice: 300,
    extrasPrice: 50,
    totalPrice: 350,
    isPaid: true,
    depositPaid: false,
    depositAmount: 87.5,
    paymentMethod: 'online',
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
    specialRequests: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as IBooking;
}

// Helper to create mock settings
function createMockSettings(
  policy: 'flexible' | 'moderate' | 'strict'
): ISettings {
  return {
    cancellationPolicy: policy,
    minBookingLength: 1,
    maxBookingLength: 30,
    maxGuestsPerBooking: 8,
    breakfastPrice: 15,
    checkInTime: '15:00',
    checkOutTime: '11:00',
    requireDeposit: true,
    depositPercentage: 25,
    allowPets: true,
    petFee: 20,
    smokingAllowed: false,
    earlyCheckInFee: 50,
    lateCheckOutFee: 50,
    wifiIncluded: true,
    parkingIncluded: false,
    parkingFee: 10,
    currency: 'USD',
    timezone: 'UTC',
  } as unknown as ISettings;
}

describe('calculateRefund', () => {
  describe('flexible policy', () => {
    const settings = createMockSettings('flexible');

    it('returns 100% refund when cancelled 1+ days before check-in', () => {
      const booking = createMockBooking({
        checkInDate: new Date('2026-02-15'),
        totalPrice: 350,
        isPaid: true,
      });
      // Cancel 5 days before
      const cancellationDate = new Date('2026-02-10');

      const result = calculateRefund(booking, settings, cancellationDate);

      expect(result.refundPercentage).toBe(100);
      expect(result.refundAmount).toBe(350);
      expect(result.refundType).toBe('full');
      expect(result.policy).toBe('flexible');
    });

    it('returns 100% refund when cancelled exactly 1 day before check-in', () => {
      const booking = createMockBooking({
        checkInDate: new Date('2026-02-15'),
        totalPrice: 350,
        isPaid: true,
      });
      // Cancel exactly 1 day before
      const cancellationDate = new Date('2026-02-14');

      const result = calculateRefund(booking, settings, cancellationDate);

      expect(result.refundPercentage).toBe(100);
      expect(result.refundAmount).toBe(350);
      expect(result.refundType).toBe('full');
    });

    it('returns 0% refund when cancelled on check-in day (less than 24 hours)', () => {
      const booking = createMockBooking({
        checkInDate: new Date('2026-02-15'),
        totalPrice: 350,
        isPaid: true,
      });
      // Cancel on check-in day
      const cancellationDate = new Date('2026-02-15');

      const result = calculateRefund(booking, settings, cancellationDate);

      expect(result.refundPercentage).toBe(0);
      expect(result.refundAmount).toBe(0);
      expect(result.refundType).toBe('none');
    });
  });

  describe('moderate policy', () => {
    const settings = createMockSettings('moderate');

    it('returns 100% refund when cancelled 5+ days before check-in', () => {
      const booking = createMockBooking({
        checkInDate: new Date('2026-02-15'),
        totalPrice: 350,
        isPaid: true,
      });
      // Cancel 7 days before
      const cancellationDate = new Date('2026-02-08');

      const result = calculateRefund(booking, settings, cancellationDate);

      expect(result.refundPercentage).toBe(100);
      expect(result.refundAmount).toBe(350);
      expect(result.refundType).toBe('full');
    });

    it('returns 100% refund when cancelled exactly 5 days before check-in', () => {
      const booking = createMockBooking({
        checkInDate: new Date('2026-02-15'),
        totalPrice: 350,
        isPaid: true,
      });
      // Cancel exactly 5 days before
      const cancellationDate = new Date('2026-02-10');

      const result = calculateRefund(booking, settings, cancellationDate);

      expect(result.refundPercentage).toBe(100);
      expect(result.refundAmount).toBe(350);
      expect(result.refundType).toBe('full');
    });

    it('returns 50% refund when cancelled 2-5 days before check-in', () => {
      const booking = createMockBooking({
        checkInDate: new Date('2026-02-15'),
        totalPrice: 350,
        isPaid: true,
      });
      // Cancel 3 days before
      const cancellationDate = new Date('2026-02-12');

      const result = calculateRefund(booking, settings, cancellationDate);

      expect(result.refundPercentage).toBe(50);
      expect(result.refundAmount).toBe(175);
      expect(result.refundType).toBe('partial');
    });

    it('returns 50% refund when cancelled exactly 2 days before check-in', () => {
      const booking = createMockBooking({
        checkInDate: new Date('2026-02-15'),
        totalPrice: 350,
        isPaid: true,
      });
      // Cancel exactly 2 days before
      const cancellationDate = new Date('2026-02-13');

      const result = calculateRefund(booking, settings, cancellationDate);

      expect(result.refundPercentage).toBe(50);
      expect(result.refundAmount).toBe(175);
      expect(result.refundType).toBe('partial');
    });

    it('returns 0% refund when cancelled less than 2 days before check-in', () => {
      const booking = createMockBooking({
        checkInDate: new Date('2026-02-15'),
        totalPrice: 350,
        isPaid: true,
      });
      // Cancel 1 day before
      const cancellationDate = new Date('2026-02-14');

      const result = calculateRefund(booking, settings, cancellationDate);

      expect(result.refundPercentage).toBe(0);
      expect(result.refundAmount).toBe(0);
      expect(result.refundType).toBe('none');
    });
  });

  describe('strict policy', () => {
    const settings = createMockSettings('strict');

    it('returns 50% refund when cancelled 7+ days before check-in', () => {
      const booking = createMockBooking({
        checkInDate: new Date('2026-02-15'),
        totalPrice: 350,
        isPaid: true,
      });
      // Cancel 10 days before
      const cancellationDate = new Date('2026-02-05');

      const result = calculateRefund(booking, settings, cancellationDate);

      expect(result.refundPercentage).toBe(50);
      expect(result.refundAmount).toBe(175);
      expect(result.refundType).toBe('partial');
    });

    it('returns 50% refund when cancelled exactly 7 days before check-in', () => {
      const booking = createMockBooking({
        checkInDate: new Date('2026-02-15'),
        totalPrice: 350,
        isPaid: true,
      });
      // Cancel exactly 7 days before
      const cancellationDate = new Date('2026-02-08');

      const result = calculateRefund(booking, settings, cancellationDate);

      expect(result.refundPercentage).toBe(50);
      expect(result.refundAmount).toBe(175);
      expect(result.refundType).toBe('partial');
    });

    it('returns 0% refund when cancelled less than 7 days before check-in', () => {
      const booking = createMockBooking({
        checkInDate: new Date('2026-02-15'),
        totalPrice: 350,
        isPaid: true,
      });
      // Cancel 5 days before
      const cancellationDate = new Date('2026-02-10');

      const result = calculateRefund(booking, settings, cancellationDate);

      expect(result.refundPercentage).toBe(0);
      expect(result.refundAmount).toBe(0);
      expect(result.refundType).toBe('none');
    });
  });

  describe('edge cases', () => {
    it('returns 0 refund when no payment has been made', () => {
      const booking = createMockBooking({
        isPaid: false,
        depositPaid: false,
        totalPrice: 350,
      });
      const settings = createMockSettings('flexible');
      const cancellationDate = new Date('2026-02-10');

      const result = calculateRefund(booking, settings, cancellationDate);

      expect(result.refundPercentage).toBe(0);
      expect(result.refundAmount).toBe(0);
      expect(result.refundType).toBe('none');
      expect(result.reason).toBe('No payment has been made for this booking');
    });

    it('calculates refund based on depositAmount when only deposit is paid', () => {
      const booking = createMockBooking({
        isPaid: false,
        depositPaid: true,
        depositAmount: 100,
        totalPrice: 400,
      });
      const settings = createMockSettings('flexible');
      // Cancel 5 days before - should get full refund of deposit
      const cancellationDate = new Date('2026-02-10');

      const result = calculateRefund(booking, settings, cancellationDate);

      expect(result.refundPercentage).toBe(100);
      expect(result.refundAmount).toBe(100); // Deposit amount, not total
      expect(result.refundType).toBe('full');
    });

    it('handles undefined depositAmount when depositPaid is true', () => {
      const booking = createMockBooking({
        isPaid: false,
        depositPaid: true,
        depositAmount: undefined,
        totalPrice: 400,
      });
      const settings = createMockSettings('flexible');
      const cancellationDate = new Date('2026-02-10');

      const result = calculateRefund(booking, settings, cancellationDate);

      // Should treat undefined depositAmount as 0
      expect(result.refundAmount).toBe(0);
      expect(result.refundType).toBe('none');
    });

    it('rounds refund amount to 2 decimal places', () => {
      const booking = createMockBooking({
        isPaid: true,
        totalPrice: 333.33,
      });
      const settings = createMockSettings('moderate');
      // Cancel 3 days before - 50% refund
      const cancellationDate = new Date('2026-02-12');

      const result = calculateRefund(booking, settings, cancellationDate);

      // 333.33 * 0.5 = 166.665, should round to 166.67
      expect(result.refundAmount).toBe(166.67);
    });

    it('handles cancellation after check-in date (negative days)', () => {
      const booking = createMockBooking({
        checkInDate: new Date('2026-02-10'),
        isPaid: true,
        totalPrice: 350,
      });
      const settings = createMockSettings('flexible');
      // Cancel after check-in date
      const cancellationDate = new Date('2026-02-12');

      const result = calculateRefund(booking, settings, cancellationDate);

      expect(result.daysUntilCheckIn).toBeLessThan(0);
      expect(result.refundPercentage).toBe(0);
      expect(result.refundAmount).toBe(0);
      expect(result.refundType).toBe('none');
    });
  });
});

describe('getCancellationDeadlines', () => {
  // Helper to compare dates by year/month/day only (ignoring timezone)
  function getDateParts(date: Date | null) {
    if (!date) return null;
    return {
      year: date.getFullYear(),
      month: date.getMonth(),
      day: date.getDate(),
    };
  }

  it('returns correct deadlines for flexible policy', () => {
    const checkInDate = new Date(2026, 1, 15); // Feb 15, 2026 in local time
    const result = getCancellationDeadlines(checkInDate, 'flexible');

    expect(result.policy).toBe('flexible');
    // Full refund deadline: 1 day before check-in = Feb 14
    expect(getDateParts(result.fullRefundDeadline)).toEqual({
      year: 2026,
      month: 1,
      day: 14,
    });
    expect(result.partialRefundDeadline).toBeNull();
    expect(result.partialRefundPercentage).toBe(0);
  });

  it('returns correct deadlines for moderate policy', () => {
    const checkInDate = new Date(2026, 1, 15); // Feb 15, 2026 in local time
    const result = getCancellationDeadlines(checkInDate, 'moderate');

    expect(result.policy).toBe('moderate');
    // Full refund deadline: 5 days before = Feb 10
    expect(getDateParts(result.fullRefundDeadline)).toEqual({
      year: 2026,
      month: 1,
      day: 10,
    });
    // Partial refund deadline: 2 days before = Feb 13
    expect(getDateParts(result.partialRefundDeadline)).toEqual({
      year: 2026,
      month: 1,
      day: 13,
    });
    expect(result.partialRefundPercentage).toBe(50);
  });

  it('returns correct deadlines for strict policy', () => {
    const checkInDate = new Date(2026, 1, 15); // Feb 15, 2026 in local time
    const result = getCancellationDeadlines(checkInDate, 'strict');

    expect(result.policy).toBe('strict');
    expect(result.fullRefundDeadline).toBeNull();
    // Partial refund deadline: 7 days before = Feb 8
    expect(getDateParts(result.partialRefundDeadline)).toEqual({
      year: 2026,
      month: 1,
      day: 8,
    });
    expect(result.partialRefundPercentage).toBe(50);
  });
});

describe('formatCancellationPolicy', () => {
  it('formats flexible policy correctly', () => {
    expect(formatCancellationPolicy('flexible')).toBe(
      'Full refund up to 24 hours before check-in'
    );
  });

  it('formats moderate policy correctly', () => {
    expect(formatCancellationPolicy('moderate')).toBe(
      'Full refund 5+ days before check-in, 50% refund 2-5 days before, no refund within 2 days'
    );
  });

  it('formats strict policy correctly', () => {
    expect(formatCancellationPolicy('strict')).toBe(
      '50% refund 7+ days before check-in, no refund within 7 days'
    );
  });
});
