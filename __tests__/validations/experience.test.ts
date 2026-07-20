import {
  createExperienceSchema,
  updateExperienceSchema,
  difficultySchema,
} from '@/lib/validations/experience';

describe('Experience Validation Schemas', () => {
  describe('difficultySchema', () => {
    it('accepts canonical difficulty values', () => {
      const validLevels = ['Easy', 'Moderate', 'Challenging'];
      validLevels.forEach(level => {
        expect(difficultySchema.safeParse(level).success).toBe(true);
      });
    });

    it('rejects non-canonical difficulty values', () => {
      const invalidLevels = ['easy', 'moderate', 'challenging', 'expert'];
      invalidLevels.forEach(level => {
        expect(difficultySchema.safeParse(level).success).toBe(false);
      });
    });
  });

  describe('createExperienceSchema', () => {
    const validExperience = {
      name: 'Mountain Hiking Tour',
      description: 'An exciting hiking tour through scenic mountain trails.',
      duration: '4 hours',
      price: 75,
      difficulty: 'Moderate' as const,
      category: 'Outdoor',
      image: 'https://example.com/tour.jpg',
      includes: ['Guide', 'Water'],
      available: ['Weekends', 'Weekdays'],
      ctaText: 'Book Now',
    };

    it('accepts valid experience data', () => {
      const result = createExperienceSchema.safeParse(validExperience);
      expect(result.success).toBe(true);
    });

    it('applies defaults for isPopular and reviewCount', () => {
      const result = createExperienceSchema.safeParse(validExperience);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isPopular).toBe(false);
        expect(result.data.reviewCount).toBe(0);
      }
    });

    it('requires non-empty includes and available arrays', () => {
      expect(
        createExperienceSchema.safeParse({ ...validExperience, includes: [] })
          .success
      ).toBe(false);
      expect(
        createExperienceSchema.safeParse({ ...validExperience, available: [] })
          .success
      ).toBe(false);
      expect(
        createExperienceSchema.safeParse({
          ...validExperience,
          includes: undefined,
          available: undefined,
        }).success
      ).toBe(false);
    });

    it('rejects unknown legacy keys', () => {
      const result = createExperienceSchema.safeParse({
        ...validExperience,
        included: ['Legacy key'],
      });

      expect(result.success).toBe(false);
    });

    it('rejects missing required fields', () => {
      const result = createExperienceSchema.safeParse({
        ...validExperience,
        ctaText: '',
      });

      expect(result.success).toBe(false);
    });

    it('validates rating range', () => {
      expect(
        createExperienceSchema.safeParse({ ...validExperience, rating: 4.5 })
          .success
      ).toBe(true);

      expect(
        createExperienceSchema.safeParse({ ...validExperience, rating: 5.1 })
          .success
      ).toBe(false);
    });

    it('validates reviewCount as non-negative integer', () => {
      expect(
        createExperienceSchema.safeParse({
          ...validExperience,
          reviewCount: 12,
        }).success
      ).toBe(true);

      expect(
        createExperienceSchema.safeParse({
          ...validExperience,
          reviewCount: -1,
        }).success
      ).toBe(false);
    });
  });

  describe('updateExperienceSchema', () => {
    it('accepts partial updates', () => {
      const result = updateExperienceSchema.safeParse({
        name: 'Updated Tour Name',
        price: 100,
      });

      expect(result.success).toBe(true);
    });

    it('accepts empty updates', () => {
      const result = updateExperienceSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('rejects invalid difficulty on update', () => {
      const result = updateExperienceSchema.safeParse({
        difficulty: 'expert',
      });

      expect(result.success).toBe(false);
    });

    it('rejects unknown keys on update', () => {
      const result = updateExperienceSchema.safeParse({
        isFeatured: true,
      });

      expect(result.success).toBe(false);
    });

    it('does not fill in defaults for fields absent from the update payload', () => {
      const result = updateExperienceSchema.safeParse({
        name: 'Renamed Tour',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        // A partial update must not silently reset isPopular/reviewCount
        // back to their create-time defaults.
        expect('isPopular' in result.data).toBe(false);
        expect('reviewCount' in result.data).toBe(false);
      }
    });
  });
});
