import { createCabinSchema, updateCabinSchema } from '@/lib/validations/cabin';

describe('Cabin Validation Schemas', () => {
  describe('createCabinSchema', () => {
    const validCabin = {
      name: 'Lakeside Cabin',
      description:
        'A beautiful cabin with stunning lake views and modern amenities.',
      capacity: 4,
      price: 200,
      image: 'https://example.com/cabin.jpg',
    };

    it('accepts valid cabin data', () => {
      const result = createCabinSchema.safeParse(validCabin);
      expect(result.success).toBe(true);
    });

    it('applies default values', () => {
      const result = createCabinSchema.safeParse(validCabin);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.discount).toBe(0);
        expect(result.data.status).toBe('active');
        expect(result.data.amenities).toEqual([]);
        expect(result.data.images).toEqual([]);
        expect(result.data.extraGuestFee).toBe(0);
      }
    });

    it('rejects empty name', () => {
      const cabin = { ...validCabin, name: '' };
      const result = createCabinSchema.safeParse(cabin);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('name');
      }
    });

    it('rejects name over 100 characters', () => {
      const cabin = { ...validCabin, name: 'A'.repeat(101) };
      const result = createCabinSchema.safeParse(cabin);
      expect(result.success).toBe(false);
    });

    it('rejects description under 10 characters', () => {
      const cabin = { ...validCabin, description: 'Short' };
      const result = createCabinSchema.safeParse(cabin);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain(
          'at least 10 characters'
        );
      }
    });

    it('rejects description over 1000 characters (matches Cabin model maxlength)', () => {
      const cabin = { ...validCabin, description: 'A'.repeat(1001) };
      const result = createCabinSchema.safeParse(cabin);
      expect(result.success).toBe(false);
    });

    it('accepts description at boundary (1000 chars)', () => {
      const cabin = { ...validCabin, description: 'A'.repeat(1000) };
      const result = createCabinSchema.safeParse(cabin);
      expect(result.success).toBe(true);
    });

    it('rejects capacity less than 1', () => {
      const cabin = { ...validCabin, capacity: 0 };
      const result = createCabinSchema.safeParse(cabin);
      expect(result.success).toBe(false);
    });

    it('rejects capacity greater than 20', () => {
      const cabin = { ...validCabin, capacity: 21 };
      const result = createCabinSchema.safeParse(cabin);
      expect(result.success).toBe(false);
    });

    it('rejects non-integer capacity', () => {
      const cabin = { ...validCabin, capacity: 4.5 };
      const result = createCabinSchema.safeParse(cabin);
      expect(result.success).toBe(false);
    });

    it('rejects zero price', () => {
      const cabin = { ...validCabin, price: 0 };
      const result = createCabinSchema.safeParse(cabin);
      expect(result.success).toBe(false);
    });

    it('rejects negative price', () => {
      const cabin = { ...validCabin, price: -50 };
      const result = createCabinSchema.safeParse(cabin);
      expect(result.success).toBe(false);
    });

    it('accepts discount less than price', () => {
      const cabin = { ...validCabin, discount: 50 };
      const result = createCabinSchema.safeParse(cabin);
      expect(result.success).toBe(true);
    });

    it('rejects discount equal to price', () => {
      const cabin = { ...validCabin, discount: 200 };
      const result = createCabinSchema.safeParse(cabin);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain(
          'Discount cannot be greater than or equal to the price'
        );
      }
    });

    it('rejects discount greater than price', () => {
      const cabin = { ...validCabin, discount: 250 };
      const result = createCabinSchema.safeParse(cabin);
      expect(result.success).toBe(false);
    });

    it('accepts zero discount', () => {
      const cabin = { ...validCabin, discount: 0 };
      const result = createCabinSchema.safeParse(cabin);
      expect(result.success).toBe(true);
    });

    it('rejects negative discount', () => {
      const cabin = { ...validCabin, discount: -10 };
      const result = createCabinSchema.safeParse(cabin);
      expect(result.success).toBe(false);
    });

    it('requires an image URL', () => {
      const { image: _image, ...cabin } = validCabin;
      const result = createCabinSchema.safeParse(cabin);
      expect(result.success).toBe(false);
    });

    it('rejects invalid image URL', () => {
      const cabin = { ...validCabin, image: 'not-a-url' };
      const result = createCabinSchema.safeParse(cabin);
      expect(result.success).toBe(false);
    });

    it('accepts amenities string array', () => {
      const cabin = {
        ...validCabin,
        amenities: ['wifi', 'tv', 'pool'],
      };
      const result = createCabinSchema.safeParse(cabin);
      expect(result.success).toBe(true);
    });

    it('applies default amenities value (empty array)', () => {
      const result = createCabinSchema.safeParse(validCabin);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amenities).toEqual([]);
      }
    });

    it('accepts a gallery of image URLs', () => {
      const cabin = {
        ...validCabin,
        images: ['https://example.com/1.jpg', 'https://example.com/2.jpg'],
      };
      const result = createCabinSchema.safeParse(cabin);
      expect(result.success).toBe(true);
    });

    it('rejects an invalid gallery image URL', () => {
      const cabin = { ...validCabin, images: ['not-a-url'] };
      const result = createCabinSchema.safeParse(cabin);
      expect(result.success).toBe(false);
    });

    it('accepts valid status values', () => {
      (['active', 'maintenance', 'inactive'] as const).forEach(status => {
        const result = createCabinSchema.safeParse({ ...validCabin, status });
        expect(result.success).toBe(true);
      });
    });

    it('rejects invalid status value', () => {
      const cabin = { ...validCabin, status: 'closed' };
      const result = createCabinSchema.safeParse(cabin);
      expect(result.success).toBe(false);
    });

    it('accepts bedrooms, bathrooms, and size', () => {
      const cabin = { ...validCabin, bedrooms: 2, bathrooms: 1, size: 800 };
      const result = createCabinSchema.safeParse(cabin);
      expect(result.success).toBe(true);
    });

    it('rejects bedrooms less than 1', () => {
      const cabin = { ...validCabin, bedrooms: 0 };
      const result = createCabinSchema.safeParse(cabin);
      expect(result.success).toBe(false);
    });

    it('accepts minNights', () => {
      const cabin = { ...validCabin, minNights: 2 };
      const result = createCabinSchema.safeParse(cabin);
      expect(result.success).toBe(true);
    });

    it('rejects minNights less than 1', () => {
      const cabin = { ...validCabin, minNights: 0 };
      const result = createCabinSchema.safeParse(cabin);
      expect(result.success).toBe(false);
    });

    it('accepts extraGuestFee and defaults to 0', () => {
      const withFee = createCabinSchema.safeParse({
        ...validCabin,
        extraGuestFee: 25,
      });
      expect(withFee.success).toBe(true);
      if (withFee.success) {
        expect(withFee.data.extraGuestFee).toBe(25);
      }

      const withoutFee = createCabinSchema.safeParse(validCabin);
      expect(withoutFee.success).toBe(true);
      if (withoutFee.success) {
        expect(withoutFee.data.extraGuestFee).toBe(0);
      }
    });

    it('rejects negative extraGuestFee', () => {
      const cabin = { ...validCabin, extraGuestFee: -5 };
      const result = createCabinSchema.safeParse(cabin);
      expect(result.success).toBe(false);
    });
  });

  describe('updateCabinSchema', () => {
    it('requires _id field', () => {
      const result = updateCabinSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('_id');
      }
    });

    it('accepts valid update with only _id', () => {
      const result = updateCabinSchema.safeParse({
        _id: '65a1b2c3d4e5f6a7b8c9d0e1',
      });
      expect(result.success).toBe(true);
    });

    it('accepts partial updates', () => {
      const result = updateCabinSchema.safeParse({
        _id: '65a1b2c3d4e5f6a7b8c9d0e1',
        name: 'Updated Cabin Name',
        price: 250,
      });
      expect(result.success).toBe(true);
    });

    it('validates discount vs price when both provided', () => {
      const result = updateCabinSchema.safeParse({
        _id: '65a1b2c3d4e5f6a7b8c9d0e1',
        price: 100,
        discount: 150,
      });
      expect(result.success).toBe(false);
    });

    it('accepts discount update alone (no price check needed)', () => {
      const result = updateCabinSchema.safeParse({
        _id: '65a1b2c3d4e5f6a7b8c9d0e1',
        discount: 50,
      });
      expect(result.success).toBe(true);
    });

    it('accepts price update alone (no discount check needed)', () => {
      const result = updateCabinSchema.safeParse({
        _id: '65a1b2c3d4e5f6a7b8c9d0e1',
        price: 300,
      });
      expect(result.success).toBe(true);
    });

    it('validates URL format on image update', () => {
      const result = updateCabinSchema.safeParse({
        _id: '65a1b2c3d4e5f6a7b8c9d0e1',
        image: 'invalid-url',
      });
      expect(result.success).toBe(false);
    });

    it('rejects description over 1000 characters on update (matches create limit)', () => {
      const result = updateCabinSchema.safeParse({
        _id: '65a1b2c3d4e5f6a7b8c9d0e1',
        description: 'A'.repeat(1001),
      });
      expect(result.success).toBe(false);
    });

    it('accepts status update', () => {
      const result = updateCabinSchema.safeParse({
        _id: '65a1b2c3d4e5f6a7b8c9d0e1',
        status: 'maintenance',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid status update', () => {
      const result = updateCabinSchema.safeParse({
        _id: '65a1b2c3d4e5f6a7b8c9d0e1',
        status: 'closed',
      });
      expect(result.success).toBe(false);
    });

    it('accepts minNights and extraGuestFee updates', () => {
      const result = updateCabinSchema.safeParse({
        _id: '65a1b2c3d4e5f6a7b8c9d0e1',
        minNights: 3,
        extraGuestFee: 15,
      });
      expect(result.success).toBe(true);
    });

    it('accepts images gallery update', () => {
      const result = updateCabinSchema.safeParse({
        _id: '65a1b2c3d4e5f6a7b8c9d0e1',
        images: ['https://example.com/new.jpg'],
      });
      expect(result.success).toBe(true);
    });

    it('does not fill in defaults for fields absent from the update payload', () => {
      const result = updateCabinSchema.safeParse({
        _id: '65a1b2c3d4e5f6a7b8c9d0e1',
        name: 'Renamed Cabin',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        // A partial update must not silently reset discount/status/amenities/
        // images/extraGuestFee back to their create-time defaults.
        expect('discount' in result.data).toBe(false);
        expect('status' in result.data).toBe(false);
        expect('amenities' in result.data).toBe(false);
        expect('images' in result.data).toBe(false);
        expect('extraGuestFee' in result.data).toBe(false);
      }
    });
  });
});
