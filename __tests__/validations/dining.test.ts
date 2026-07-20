import {
  createDiningSchema,
  updateDiningSchema,
  diningTypeSchema,
  mealTypeSchema,
  diningCategorySchema,
} from '@/lib/validations/dining';

describe('Dining Validation Schemas', () => {
  describe('diningTypeSchema', () => {
    it('accepts valid dining types (matches Dining model)', () => {
      ['menu', 'experience'].forEach(type => {
        expect(diningTypeSchema.safeParse(type).success).toBe(true);
      });
    });

    it('rejects invalid dining types', () => {
      const result = diningTypeSchema.safeParse('brunch');
      expect(result.success).toBe(false);
    });
  });

  describe('mealTypeSchema', () => {
    it('accepts valid meal types (matches Dining model)', () => {
      ['breakfast', 'lunch', 'dinner', 'all-day'].forEach(type => {
        expect(mealTypeSchema.safeParse(type).success).toBe(true);
      });
    });

    it('rejects invalid meal types', () => {
      const result = mealTypeSchema.safeParse('vegetarian');
      expect(result.success).toBe(false);
    });
  });

  describe('diningCategorySchema', () => {
    it('accepts valid categories (matches Dining model)', () => {
      ['regular', 'craft-beer', 'wine', 'spirits', 'non-alcoholic'].forEach(
        category => {
          expect(diningCategorySchema.safeParse(category).success).toBe(true);
        }
      );
    });

    it('rejects invalid categories', () => {
      const result = diningCategorySchema.safeParse('appetizer');
      expect(result.success).toBe(false);
    });
  });

  describe('createDiningSchema', () => {
    const validDining = {
      name: 'Continental Breakfast',
      description:
        'A delicious continental breakfast with fresh pastries and coffee.',
      type: 'menu',
      mealType: 'breakfast',
      category: 'regular',
      price: 25,
      servingTime: {
        start: '07:00',
        end: '10:30',
      },
      maxPeople: 50,
      image: 'https://example.com/breakfast.jpg',
    };

    it('accepts valid dining data', () => {
      const result = createDiningSchema.safeParse(validDining);
      expect(result.success).toBe(true);
    });

    it('applies default values', () => {
      const result = createDiningSchema.safeParse(validDining);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isAvailable).toBe(true);
        expect(result.data.isPopular).toBe(false);
        expect(result.data.minPeople).toBe(1);
        expect(result.data.reviewCount).toBe(0);
      }
    });

    it('rejects empty name', () => {
      const dining = { ...validDining, name: '' };
      const result = createDiningSchema.safeParse(dining);
      expect(result.success).toBe(false);
    });

    it('rejects name over 100 characters', () => {
      const dining = { ...validDining, name: 'A'.repeat(101) };
      const result = createDiningSchema.safeParse(dining);
      expect(result.success).toBe(false);
    });

    it('rejects description under 10 characters', () => {
      const dining = { ...validDining, description: 'Short' };
      const result = createDiningSchema.safeParse(dining);
      expect(result.success).toBe(false);
    });

    it('rejects description over 1000 characters', () => {
      const dining = { ...validDining, description: 'A'.repeat(1001) };
      const result = createDiningSchema.safeParse(dining);
      expect(result.success).toBe(false);
    });

    it('rejects invalid dining type', () => {
      const dining = { ...validDining, type: 'invalid' };
      const result = createDiningSchema.safeParse(dining);
      expect(result.success).toBe(false);
    });

    it('rejects invalid meal type', () => {
      const dining = { ...validDining, mealType: 'invalid' };
      const result = createDiningSchema.safeParse(dining);
      expect(result.success).toBe(false);
    });

    it('rejects invalid category', () => {
      const dining = { ...validDining, category: 'invalid' };
      const result = createDiningSchema.safeParse(dining);
      expect(result.success).toBe(false);
    });

    it('rejects zero price', () => {
      const dining = { ...validDining, price: 0 };
      const result = createDiningSchema.safeParse(dining);
      expect(result.success).toBe(false);
    });

    it('rejects negative price', () => {
      const dining = { ...validDining, price: -10 };
      const result = createDiningSchema.safeParse(dining);
      expect(result.success).toBe(false);
    });

    it('accepts valid serving time formats', () => {
      const validTimes = [
        { start: '00:00', end: '23:59' },
        { start: '9:00', end: '17:00' },
        { start: '12:30', end: '14:00' },
      ];
      validTimes.forEach(servingTime => {
        const dining = { ...validDining, servingTime };
        const result = createDiningSchema.safeParse(dining);
        expect(result.success).toBe(true);
      });
    });

    it('rejects invalid time format', () => {
      const invalidTimes = [
        { start: '7:00 AM', end: '10:00 AM' },
        { start: '25:00', end: '10:00' },
        { start: '12:60', end: '14:00' },
        { start: 'invalid', end: '10:00' },
      ];
      invalidTimes.forEach(servingTime => {
        const dining = { ...validDining, servingTime };
        const result = createDiningSchema.safeParse(dining);
        expect(result.success).toBe(false);
      });
    });

    it('rejects maxPeople less than 1', () => {
      const dining = { ...validDining, maxPeople: 0 };
      const result = createDiningSchema.safeParse(dining);
      expect(result.success).toBe(false);
    });

    it('rejects maxPeople greater than 100', () => {
      const dining = { ...validDining, maxPeople: 101 };
      const result = createDiningSchema.safeParse(dining);
      expect(result.success).toBe(false);
    });

    it('rejects non-integer maxPeople', () => {
      const dining = { ...validDining, maxPeople: 25.5 };
      const result = createDiningSchema.safeParse(dining);
      expect(result.success).toBe(false);
    });

    it('accepts minPeople', () => {
      const dining = { ...validDining, minPeople: 5 };
      const result = createDiningSchema.safeParse(dining);
      expect(result.success).toBe(true);
    });

    it('rejects minPeople less than 1', () => {
      const dining = { ...validDining, minPeople: 0 };
      const result = createDiningSchema.safeParse(dining);
      expect(result.success).toBe(false);
    });

    it('rejects invalid image URL', () => {
      const dining = { ...validDining, image: 'not-a-url' };
      const result = createDiningSchema.safeParse(dining);
      expect(result.success).toBe(false);
    });

    it('accepts a gallery of image URLs', () => {
      const dining = {
        ...validDining,
        gallery: ['https://example.com/1.jpg', 'https://example.com/2.jpg'],
      };
      const result = createDiningSchema.safeParse(dining);
      expect(result.success).toBe(true);
    });

    it('accepts subCategory', () => {
      const dining = { ...validDining, subCategory: 'IPA' };
      const result = createDiningSchema.safeParse(dining);
      expect(result.success).toBe(true);
    });

    it('accepts ingredients array', () => {
      const dining = {
        ...validDining,
        ingredients: ['eggs', 'bacon', 'toast'],
      };
      const result = createDiningSchema.safeParse(dining);
      expect(result.success).toBe(true);
    });

    it('accepts allergens array', () => {
      const dining = {
        ...validDining,
        allergens: ['gluten', 'dairy', 'eggs'],
      };
      const result = createDiningSchema.safeParse(dining);
      expect(result.success).toBe(true);
    });

    it('accepts valid dietary options', () => {
      const dining = {
        ...validDining,
        dietary: ['vegetarian', 'gluten-free'],
      };
      const result = createDiningSchema.safeParse(dining);
      expect(result.success).toBe(true);
    });

    it('rejects invalid dietary option', () => {
      const dining = { ...validDining, dietary: ['low-carb'] };
      const result = createDiningSchema.safeParse(dining);
      expect(result.success).toBe(false);
    });

    it('accepts a valid beverages array', () => {
      const dining = {
        ...validDining,
        beverages: [
          {
            name: 'House IPA',
            description: 'Hoppy and citrusy',
            price: 8,
            alcoholContent: 6.5,
            category: 'craft-beer',
          },
        ],
      };
      const result = createDiningSchema.safeParse(dining);
      expect(result.success).toBe(true);
    });

    it('rejects a beverage missing a required name', () => {
      const dining = {
        ...validDining,
        beverages: [{ category: 'wine' }],
      };
      const result = createDiningSchema.safeParse(dining);
      expect(result.success).toBe(false);
    });

    it('rejects a beverage with an invalid category', () => {
      const dining = {
        ...validDining,
        beverages: [{ name: 'Mystery Drink', category: 'invalid' }],
      };
      const result = createDiningSchema.safeParse(dining);
      expect(result.success).toBe(false);
    });

    it('accepts includes, duration, and location (dining experience fields)', () => {
      const dining = {
        ...validDining,
        type: 'experience',
        includes: ['Guide', 'Tasting flight'],
        duration: '2 hours',
        location: 'Vineyard terrace',
      };
      const result = createDiningSchema.safeParse(dining);
      expect(result.success).toBe(true);
    });

    it('accepts specialRequirements, seasonality, and tags', () => {
      const dining = {
        ...validDining,
        specialRequirements: ['Reservation required'],
        seasonality: 'Summer only',
        tags: ['popular', 'outdoor'],
      };
      const result = createDiningSchema.safeParse(dining);
      expect(result.success).toBe(true);
    });

    it('validates rating range', () => {
      expect(
        createDiningSchema.safeParse({ ...validDining, rating: 4.5 }).success
      ).toBe(true);
      expect(
        createDiningSchema.safeParse({ ...validDining, rating: 5.1 }).success
      ).toBe(false);
    });

    it('validates reviewCount as non-negative integer', () => {
      expect(
        createDiningSchema.safeParse({ ...validDining, reviewCount: 12 })
          .success
      ).toBe(true);
      expect(
        createDiningSchema.safeParse({ ...validDining, reviewCount: -1 })
          .success
      ).toBe(false);
    });

    it('accepts isPopular true', () => {
      const dining = { ...validDining, isPopular: true };
      const result = createDiningSchema.safeParse(dining);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isPopular).toBe(true);
      }
    });

    it('does not accept a calories field that does not exist on the model', () => {
      const dining = { ...validDining, calories: 500 };
      const result = createDiningSchema.safeParse(dining);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(
          (result.data as Record<string, unknown>).calories
        ).toBeUndefined();
      }
    });
  });

  describe('updateDiningSchema', () => {
    it('requires _id field', () => {
      const result = updateDiningSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('_id');
      }
    });

    it('accepts valid update with only _id', () => {
      const result = updateDiningSchema.safeParse({
        _id: '65a1b2c3d4e5f6a7b8c9d0e1',
      });
      expect(result.success).toBe(true);
    });

    it('accepts partial updates', () => {
      const result = updateDiningSchema.safeParse({
        _id: '65a1b2c3d4e5f6a7b8c9d0e1',
        name: 'Updated Breakfast',
        price: 30,
      });
      expect(result.success).toBe(true);
    });

    it('validates dining type on update', () => {
      const result = updateDiningSchema.safeParse({
        _id: '65a1b2c3d4e5f6a7b8c9d0e1',
        type: 'invalid',
      });
      expect(result.success).toBe(false);
    });

    it('validates category on update', () => {
      const result = updateDiningSchema.safeParse({
        _id: '65a1b2c3d4e5f6a7b8c9d0e1',
        category: 'invalid',
      });
      expect(result.success).toBe(false);
    });

    it('validates serving time format on update', () => {
      const result = updateDiningSchema.safeParse({
        _id: '65a1b2c3d4e5f6a7b8c9d0e1',
        servingTime: {
          start: 'invalid',
          end: '10:00',
        },
      });
      expect(result.success).toBe(false);
    });

    it('accepts isAvailable update', () => {
      const result = updateDiningSchema.safeParse({
        _id: '65a1b2c3d4e5f6a7b8c9d0e1',
        isAvailable: false,
      });
      expect(result.success).toBe(true);
    });

    it('accepts ingredients update', () => {
      const result = updateDiningSchema.safeParse({
        _id: '65a1b2c3d4e5f6a7b8c9d0e1',
        ingredients: ['new ingredient'],
      });
      expect(result.success).toBe(true);
    });

    it('accepts allergens update', () => {
      const result = updateDiningSchema.safeParse({
        _id: '65a1b2c3d4e5f6a7b8c9d0e1',
        allergens: ['peanuts'],
      });
      expect(result.success).toBe(true);
    });

    it('accepts beverages update', () => {
      const result = updateDiningSchema.safeParse({
        _id: '65a1b2c3d4e5f6a7b8c9d0e1',
        beverages: [{ name: 'Merlot', category: 'wine' }],
      });
      expect(result.success).toBe(true);
    });

    it('does not fill in defaults for fields absent from the update payload', () => {
      const result = updateDiningSchema.safeParse({
        _id: '65a1b2c3d4e5f6a7b8c9d0e1',
        name: 'Renamed Item',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        // A partial update must not silently reset minPeople/isPopular/
        // isAvailable/reviewCount back to their create-time defaults.
        expect('minPeople' in result.data).toBe(false);
        expect('isPopular' in result.data).toBe(false);
        expect('isAvailable' in result.data).toBe(false);
        expect('reviewCount' in result.data).toBe(false);
      }
    });

    it('strips $-operator and dotted keys from a valid update payload', () => {
      const result = updateDiningSchema.safeParse({
        _id: '65a1b2c3d4e5f6a7b8c9d0e1',
        name: 'Renamed Item',
        $set: { price: 1 },
        'tags.0': 'hacked',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect('$set' in result.data).toBe(false);
        expect('tags.0' in result.data).toBe(false);
      }
    });
  });
});
