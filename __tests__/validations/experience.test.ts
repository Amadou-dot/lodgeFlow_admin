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

    it('silently strips unknown legacy keys', () => {
      const result = createExperienceSchema.safeParse({
        ...validExperience,
        included: ['Legacy key'],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect('included' in result.data).toBe(false);
      }
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
    it('requires _id field', () => {
      const result = updateExperienceSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('_id');
      }
    });

    it('accepts valid update with only _id', () => {
      const result = updateExperienceSchema.safeParse({
        _id: '65a1b2c3d4e5f6a7b8c9d0e1',
      });
      expect(result.success).toBe(true);
    });

    it('accepts partial updates', () => {
      const result = updateExperienceSchema.safeParse({
        _id: '65a1b2c3d4e5f6a7b8c9d0e1',
        name: 'Updated Tour Name',
        price: 100,
      });

      expect(result.success).toBe(true);
    });

    it('rejects invalid difficulty on update', () => {
      const result = updateExperienceSchema.safeParse({
        _id: '65a1b2c3d4e5f6a7b8c9d0e1',
        difficulty: 'expert',
      });

      expect(result.success).toBe(false);
    });

    it('silently strips unknown keys on update', () => {
      const result = updateExperienceSchema.safeParse({
        _id: '65a1b2c3d4e5f6a7b8c9d0e1',
        isFeatured: true,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect('isFeatured' in result.data).toBe(false);
      }
    });

    it('accepts a full round-tripped experience object (as the edit UI sends it)', () => {
      // The Experiences admin UI fetches an experience, lets the user edit
      // it, then PUTs the whole object back — including _id, createdAt, and
      // updatedAt. These aren't schema fields and must be silently dropped
      // rather than causing the whole update to be rejected.
      const result = updateExperienceSchema.safeParse({
        _id: '65a1b2c3d4e5f6a7b8c9d0e1',
        name: 'Updated Tour Name',
        price: 100,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect('createdAt' in result.data).toBe(false);
        expect('updatedAt' in result.data).toBe(false);
      }
    });

    it('strips $-operator and dotted keys from a valid update payload', () => {
      const result = updateExperienceSchema.safeParse({
        _id: '65a1b2c3d4e5f6a7b8c9d0e1',
        name: 'Updated Tour Name',
        $set: { price: 1 },
        'tags.0': 'hacked',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect('$set' in result.data).toBe(false);
        expect('tags.0' in result.data).toBe(false);
      }
    });

    it('does not fill in defaults for fields absent from the update payload', () => {
      const result = updateExperienceSchema.safeParse({
        _id: '65a1b2c3d4e5f6a7b8c9d0e1',
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
