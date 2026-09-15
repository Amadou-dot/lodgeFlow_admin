import Dining from '@/models/Dining';

function createDiningData(overrides: Record<string, any> = {}) {
  return {
    name: 'Mountain Breakfast Platter',
    description: 'A hearty breakfast with eggs, bacon, and toast',
    type: 'menu' as const,
    mealType: 'breakfast' as const,
    price: 25,
    servingTime: { start: '07:00', end: '10:00' },
    maxPeople: 6,
    category: 'regular' as const,
    image: 'https://example.com/breakfast.jpg',
    ...overrides,
  };
}

describe('Dining Model', () => {
  describe('Document Creation', () => {
    it('creates a dining item with valid data', async () => {
      const dining = await Dining.create(createDiningData());

      expect(dining._id).toBeDefined();
      expect(dining.name).toBe('Mountain Breakfast Platter');
      expect(dining.type).toBe('menu');
      expect(dining.mealType).toBe('breakfast');
      expect(dining.price).toBe(25);
    });

    it('sets default values', async () => {
      const dining = await Dining.create(createDiningData());

      expect(dining.minPeople).toBe(1);
      expect(dining.isPopular).toBe(false);
      expect(dining.isAvailable).toBe(true);
      expect(dining.reviewCount).toBe(0);
      expect(dining.gallery).toEqual([]);
      expect(dining.ingredients).toEqual([]);
      expect(dining.allergens).toEqual([]);
      expect(dining.dietary).toEqual([]);
      expect(dining.tags).toEqual([]);
    });

    it('requires name', async () => {
      await expect(
        Dining.create(createDiningData({ name: undefined }))
      ).rejects.toThrow();
    });

    it('requires description', async () => {
      await expect(
        Dining.create(createDiningData({ description: undefined }))
      ).rejects.toThrow();
    });

    it('requires type', async () => {
      await expect(
        Dining.create(createDiningData({ type: undefined }))
      ).rejects.toThrow();
    });

    it('validates type enum', async () => {
      await expect(
        Dining.create(createDiningData({ type: 'invalid' }))
      ).rejects.toThrow();
    });

    it('requires mealType', async () => {
      await expect(
        Dining.create(createDiningData({ mealType: undefined }))
      ).rejects.toThrow();
    });

    it('validates mealType enum', async () => {
      await expect(
        Dining.create(createDiningData({ mealType: 'brunch' }))
      ).rejects.toThrow();
    });

    it('accepts valid mealType values', async () => {
      for (const mealType of ['breakfast', 'lunch', 'dinner', 'all-day']) {
        const dining = await Dining.create(createDiningData({ mealType }));
        expect(dining.mealType).toBe(mealType);
      }
    });

    it('requires price', async () => {
      await expect(
        Dining.create(createDiningData({ price: undefined }))
      ).rejects.toThrow();
    });

    it('requires servingTime', async () => {
      await expect(
        Dining.create(createDiningData({ servingTime: undefined }))
      ).rejects.toThrow();
    });

    it('requires category', async () => {
      await expect(
        Dining.create(createDiningData({ category: undefined }))
      ).rejects.toThrow();
    });

    it('validates category enum', async () => {
      await expect(
        Dining.create(createDiningData({ category: 'seafood' }))
      ).rejects.toThrow();
    });

    it('accepts valid category values', async () => {
      for (const category of [
        'regular',
        'craft-beer',
        'wine',
        'spirits',
        'non-alcoholic',
      ]) {
        const dining = await Dining.create(createDiningData({ category }));
        expect(dining.category).toBe(category);
      }
    });

    it('requires image', async () => {
      await expect(
        Dining.create(createDiningData({ image: undefined }))
      ).rejects.toThrow();
    });

    it('requires maxPeople', async () => {
      await expect(
        Dining.create(createDiningData({ maxPeople: undefined }))
      ).rejects.toThrow();
    });

    it('validates dietary enum values', async () => {
      const dining = await Dining.create(
        createDiningData({ dietary: ['vegetarian', 'vegan', 'gluten-free'] })
      );

      expect(dining.dietary).toEqual(['vegetarian', 'vegan', 'gluten-free']);
    });

    it('rejects invalid dietary values', async () => {
      await expect(
        Dining.create(createDiningData({ dietary: ['invalid-diet'] }))
      ).rejects.toThrow();
    });

    it('validates rating range (0-5)', async () => {
      const dining = await Dining.create(createDiningData({ rating: 4.5 }));
      expect(dining.rating).toBe(4.5);

      await expect(
        Dining.create(createDiningData({ rating: 6 }))
      ).rejects.toThrow();

      await expect(
        Dining.create(createDiningData({ rating: -1 }))
      ).rejects.toThrow();
    });
  });

  describe('Beverages Subdocument', () => {
    it('creates dining with beverages', async () => {
      const dining = await Dining.create(
        createDiningData({
          beverages: [
            {
              name: 'Craft IPA',
              description: 'Hoppy and refreshing',
              price: 8,
              alcoholContent: 6.5,
              category: 'craft-beer',
            },
          ],
        })
      );

      expect(dining.beverages).toHaveLength(1);
      expect(dining.beverages![0].name).toBe('Craft IPA');
      expect(dining.beverages![0].category).toBe('craft-beer');
    });

    it('validates beverage category enum', async () => {
      await expect(
        Dining.create(
          createDiningData({
            beverages: [{ name: 'Bad Drink', category: 'invalid-category' }],
          })
        )
      ).rejects.toThrow();
    });
  });

  describe('CRUD Operations', () => {
    it('reads dining item by ID', async () => {
      const created = await Dining.create(createDiningData());
      const found = await Dining.findById(created._id);

      expect(found).not.toBeNull();
      expect(found!.name).toBe('Mountain Breakfast Platter');
    });

    it('updates dining item fields', async () => {
      const dining = await Dining.create(createDiningData());
      dining.price = 30;
      dining.isPopular = true;
      await dining.save();

      const updated = await Dining.findById(dining._id);
      expect(updated!.price).toBe(30);
      expect(updated!.isPopular).toBe(true);
    });

    it('deletes dining item', async () => {
      const dining = await Dining.create(createDiningData());
      await Dining.findByIdAndDelete(dining._id);

      const found = await Dining.findById(dining._id);
      expect(found).toBeNull();
    });

    it('queries by type and mealType', async () => {
      await Dining.create(
        createDiningData({ type: 'menu', mealType: 'breakfast' })
      );
      await Dining.create(
        createDiningData({ type: 'experience', mealType: 'dinner' })
      );

      const menus = await Dining.find({ type: 'menu' });
      expect(menus).toHaveLength(1);

      const dinners = await Dining.find({ mealType: 'dinner' });
      expect(dinners).toHaveLength(1);
    });

    it('queries by availability', async () => {
      await Dining.create(createDiningData({ isAvailable: true }));
      await Dining.create(createDiningData({ isAvailable: false }));

      const available = await Dining.find({ isAvailable: true });
      expect(available).toHaveLength(1);
    });
  });

  describe('Timestamps', () => {
    it('automatically adds createdAt and updatedAt', async () => {
      const dining = await Dining.create(createDiningData());

      expect(dining.createdAt).toBeDefined();
      expect(dining.updatedAt).toBeDefined();
    });
  });

  describe('Indexes', () => {
    it('has compound index on type and mealType', async () => {
      const indexes = await Dining.collection.indexes();
      const idx = indexes.find(
        (i: any) => i.key.type === 1 && i.key.mealType === 1
      );
      expect(idx).toBeDefined();
    });

    it('has index on category', async () => {
      const indexes = await Dining.collection.indexes();
      const idx = indexes.find((i: any) => i.key.category === 1);
      expect(idx).toBeDefined();
    });

    it('has index on isAvailable', async () => {
      const indexes = await Dining.collection.indexes();
      const idx = indexes.find((i: any) => i.key.isAvailable === 1);
      expect(idx).toBeDefined();
    });

    it('has index on isPopular', async () => {
      const indexes = await Dining.collection.indexes();
      const idx = indexes.find((i: any) => i.key.isPopular === 1);
      expect(idx).toBeDefined();
    });
  });
});
