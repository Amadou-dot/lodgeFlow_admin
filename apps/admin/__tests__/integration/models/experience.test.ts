import { Experience } from '@/models/Experience';

function createExperienceData(overrides: Record<string, any> = {}) {
  return {
    name: 'Mountain Hiking Tour',
    price: 75,
    duration: '4 hours',
    difficulty: 'Moderate' as const,
    category: 'outdoor',
    description: 'A guided hiking tour through the mountains',
    image: 'https://example.com/hiking.jpg',
    includes: ['Guide', 'Water bottle', 'Snacks'],
    available: ['Monday', 'Wednesday', 'Saturday'],
    ctaText: 'Book Now',
    ...overrides,
  };
}

describe('Experience Model', () => {
  describe('Document Creation', () => {
    it('creates an experience with valid data', async () => {
      const experience = await Experience.create(createExperienceData());

      expect(experience._id).toBeDefined();
      expect(experience.name).toBe('Mountain Hiking Tour');
      expect(experience.price).toBe(75);
      expect(experience.duration).toBe('4 hours');
      expect(experience.difficulty).toBe('Moderate');
      expect(experience.category).toBe('outdoor');
    });

    it('sets default values', async () => {
      const experience = await Experience.create(createExperienceData());

      expect(experience.isPopular).toBe(false);
      expect(experience.reviewCount).toBe(0);
      expect(experience.gallery).toEqual([]);
      expect(experience.requirements).toEqual([]);
      expect(experience.highlights).toEqual([]);
      expect(experience.whatToBring).toEqual([]);
      expect(experience.tags).toEqual([]);
    });

    it('requires name', async () => {
      await expect(
        Experience.create(createExperienceData({ name: undefined }))
      ).rejects.toThrow();
    });

    it('requires price', async () => {
      await expect(
        Experience.create(createExperienceData({ price: undefined }))
      ).rejects.toThrow();
    });

    it('requires duration', async () => {
      await expect(
        Experience.create(createExperienceData({ duration: undefined }))
      ).rejects.toThrow();
    });

    it('requires difficulty', async () => {
      await expect(
        Experience.create(createExperienceData({ difficulty: undefined }))
      ).rejects.toThrow();
    });

    it('validates difficulty enum', async () => {
      await expect(
        Experience.create(createExperienceData({ difficulty: 'Extreme' }))
      ).rejects.toThrow();
    });

    it('accepts valid difficulty values', async () => {
      for (const difficulty of ['Easy', 'Moderate', 'Challenging']) {
        const experience = await Experience.create(
          createExperienceData({ difficulty })
        );
        expect(experience.difficulty).toBe(difficulty);
      }
    });

    it('requires category', async () => {
      await expect(
        Experience.create(createExperienceData({ category: undefined }))
      ).rejects.toThrow();
    });

    it('requires description', async () => {
      await expect(
        Experience.create(createExperienceData({ description: undefined }))
      ).rejects.toThrow();
    });

    it('requires image', async () => {
      await expect(
        Experience.create(createExperienceData({ image: undefined }))
      ).rejects.toThrow();
    });

    it('defaults includes to empty array when undefined', async () => {
      const experience = await Experience.create(
        createExperienceData({ includes: undefined })
      );
      expect(experience.includes).toEqual([]);
    });

    it('defaults available to empty array when undefined', async () => {
      const experience = await Experience.create(
        createExperienceData({ available: undefined })
      );
      expect(experience.available).toEqual([]);
    });

    it('requires ctaText', async () => {
      await expect(
        Experience.create(createExperienceData({ ctaText: undefined }))
      ).rejects.toThrow();
    });

    it('validates rating range (0-5)', async () => {
      const experience = await Experience.create(
        createExperienceData({ rating: 4.2 })
      );
      expect(experience.rating).toBe(4.2);

      await expect(
        Experience.create(createExperienceData({ rating: 6 }))
      ).rejects.toThrow();

      await expect(
        Experience.create(createExperienceData({ rating: -1 }))
      ).rejects.toThrow();
    });

    it('stores optional fields correctly', async () => {
      const experience = await Experience.create(
        createExperienceData({
          longDescription: 'An extended description of the hike',
          maxParticipants: 12,
          minAge: 10,
          location: 'Mountain Peak Trail',
          cancellationPolicy: '24 hours notice required',
          seasonality: 'spring-summer',
        })
      );

      expect(experience.longDescription).toBe(
        'An extended description of the hike'
      );
      expect(experience.maxParticipants).toBe(12);
      expect(experience.minAge).toBe(10);
      expect(experience.location).toBe('Mountain Peak Trail');
      expect(experience.cancellationPolicy).toBe('24 hours notice required');
      expect(experience.seasonality).toBe('spring-summer');
    });

    it('stores array fields correctly', async () => {
      const experience = await Experience.create(
        createExperienceData({
          highlights: ['Scenic views', 'Wildlife spotting'],
          whatToBring: ['Hiking boots', 'Sunscreen'],
          requirements: ['Moderate fitness level'],
          tags: ['hiking', 'nature', 'outdoor'],
        })
      );

      expect(experience.highlights).toEqual([
        'Scenic views',
        'Wildlife spotting',
      ]);
      expect(experience.whatToBring).toEqual(['Hiking boots', 'Sunscreen']);
      expect(experience.requirements).toEqual(['Moderate fitness level']);
      expect(experience.tags).toEqual(['hiking', 'nature', 'outdoor']);
    });
  });

  describe('CRUD Operations', () => {
    it('reads experience by ID', async () => {
      const created = await Experience.create(createExperienceData());
      const found = await Experience.findById(created._id);

      expect(found).not.toBeNull();
      expect(found!.name).toBe('Mountain Hiking Tour');
    });

    it('updates experience fields', async () => {
      const experience = await Experience.create(createExperienceData());
      experience.price = 100;
      experience.isPopular = true;
      await experience.save();

      const updated = await Experience.findById(experience._id);
      expect(updated!.price).toBe(100);
      expect(updated!.isPopular).toBe(true);
    });

    it('deletes experience', async () => {
      const experience = await Experience.create(createExperienceData());
      await Experience.findByIdAndDelete(experience._id);

      const found = await Experience.findById(experience._id);
      expect(found).toBeNull();
    });

    it('queries by difficulty', async () => {
      await Experience.create(createExperienceData({ difficulty: 'Easy' }));
      await Experience.create(
        createExperienceData({ difficulty: 'Challenging' })
      );

      const easy = await Experience.find({ difficulty: 'Easy' });
      expect(easy).toHaveLength(1);

      const challenging = await Experience.find({ difficulty: 'Challenging' });
      expect(challenging).toHaveLength(1);
    });

    it('queries by category', async () => {
      await Experience.create(createExperienceData({ category: 'outdoor' }));
      await Experience.create(
        createExperienceData({ category: 'water-sports' })
      );

      const outdoor = await Experience.find({ category: 'outdoor' });
      expect(outdoor).toHaveLength(1);
    });

    it('queries popular experiences', async () => {
      await Experience.create(createExperienceData({ isPopular: true }));
      await Experience.create(createExperienceData({ isPopular: false }));

      const popular = await Experience.find({ isPopular: true });
      expect(popular).toHaveLength(1);
    });
  });

  describe('Timestamps', () => {
    it('automatically adds createdAt and updatedAt', async () => {
      const experience = await Experience.create(createExperienceData());

      expect(experience.createdAt).toBeDefined();
      expect(experience.updatedAt).toBeDefined();
    });
  });
});
