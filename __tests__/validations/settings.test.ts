import {
  getBookingLengthRangeError,
  stripSettingsMongoMetadata,
  updateSettingsSchema,
} from '@/lib/validations/settings';

describe('Settings Validation Schemas', () => {
  describe('updateSettingsSchema', () => {
    it('accepts valid partial updates', () => {
      const result = updateSettingsSchema.safeParse({
        breakfastPrice: 20,
        depositPercentage: 25,
      });
      expect(result.success).toBe(true);
    });

    it('accepts empty object for no-op partial update', () => {
      const result = updateSettingsSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('rejects out-of-range depositPercentage', () => {
      const result = updateSettingsSchema.safeParse({ depositPercentage: 101 });
      expect(result.success).toBe(false);
    });

    it('rejects negative breakfastPrice', () => {
      const result = updateSettingsSchema.safeParse({ breakfastPrice: -1 });
      expect(result.success).toBe(false);
    });

    it('rejects minBookingLength below 1', () => {
      const result = updateSettingsSchema.safeParse({ minBookingLength: 0 });
      expect(result.success).toBe(false);
    });

    it('rejects maxBookingLength above 365', () => {
      const result = updateSettingsSchema.safeParse({ maxBookingLength: 400 });
      expect(result.success).toBe(false);
    });

    it('rejects minBookingLength greater than maxBookingLength in payload', () => {
      const result = updateSettingsSchema.safeParse({
        minBookingLength: 10,
        maxBookingLength: 5,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some(issue => issue.path.includes('maxBookingLength'))
        ).toBe(true);
      }
    });

    it('rejects unknown keys via strict mode', () => {
      const result = updateSettingsSchema.safeParse({
        breakfastPrice: 20,
        taxRate: 10,
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid cancellationPolicy', () => {
      const result = updateSettingsSchema.safeParse({
        cancellationPolicy: 'lenient',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid checkInTime format', () => {
      const result = updateSettingsSchema.safeParse({
        checkInTime: '25:00',
      });
      expect(result.success).toBe(false);
    });

    it('rejects lowercase currency code', () => {
      const result = updateSettingsSchema.safeParse({ currency: 'usd' });
      expect(result.success).toBe(false);
    });

    it('accepts uppercase 3-character currency code', () => {
      const result = updateSettingsSchema.safeParse({ currency: 'EUR' });
      expect(result.success).toBe(true);
    });

    it('accepts nested businessHours updates', () => {
      const result = updateSettingsSchema.safeParse({
        businessHours: {
          open: '08:00',
          close: '20:00',
          daysOpen: ['monday', 'tuesday'],
        },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('stripSettingsMongoMetadata', () => {
    it('removes MongoDB metadata fields before validation', () => {
      const cleaned = stripSettingsMongoMetadata({
        _id: '507f1f77bcf86cd799439011',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
        __v: 0,
        breakfastPrice: 20,
      });

      const result = updateSettingsSchema.safeParse(cleaned);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.breakfastPrice).toBe(20);
      }
    });
  });

  describe('getBookingLengthRangeError', () => {
    it('returns null when min is less than or equal to max', () => {
      expect(getBookingLengthRangeError(2, 30)).toBeNull();
      expect(getBookingLengthRangeError(5, 5)).toBeNull();
    });

    it('returns error message when min exceeds max', () => {
      expect(getBookingLengthRangeError(10, 5)).toBe(
        'Maximum booking length must be greater than or equal to minimum booking length'
      );
    });
  });
});
