import { NextRequest } from 'next/server';

jest.mock('@/lib/mongodb', () => jest.fn().mockResolvedValue(undefined));

import { GET, POST, PUT } from '@/app/api/cabins/route';
import { GET as getById, PUT as updateById } from '@/app/api/cabins/[id]/route';
import Cabin from '@/models/Cabin';

function createRequest(url: string, options?: { method?: string; body?: any }) {
  const init: RequestInit = { method: options?.method || 'GET' };
  if (options?.body) {
    init.body = JSON.stringify(options.body);
    init.headers = { 'Content-Type': 'application/json' };
  }
  return new NextRequest(new URL(url, 'http://localhost:3000'), init);
}

function validCabinPayload(overrides: Record<string, any> = {}) {
  return {
    name: 'Lakeside Cabin',
    description: 'A beautiful cabin with stunning lake views and comfort.',
    capacity: 4,
    price: 200,
    image: 'https://example.com/cabin.jpg',
    ...overrides,
  };
}

describe('Cabins API Routes', () => {
  describe('GET /api/cabins', () => {
    it('returns cabins from the database', async () => {
      await Cabin.create(validCabinPayload());

      const request = createRequest('http://localhost:3000/api/cabins');
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
    });
  });

  describe('POST /api/cabins', () => {
    it('creates a cabin with a valid payload and applies schema defaults', async () => {
      const request = createRequest('http://localhost:3000/api/cabins', {
        method: 'POST',
        body: validCabinPayload(),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('active');
      expect(body.data.discount).toBe(0);

      const stored = await Cabin.findById(body.data._id);
      expect(stored).not.toBeNull();
    });

    it('rejects a payload missing required fields', async () => {
      const { image: _image, ...payload } = validCabinPayload();
      const request = createRequest('http://localhost:3000/api/cabins', {
        method: 'POST',
        body: payload,
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.details.image).toBeDefined();

      const count = await Cabin.countDocuments();
      expect(count).toBe(0);
    });

    it('rejects a discount greater than or equal to the price', async () => {
      const request = createRequest('http://localhost:3000/api/cabins', {
        method: 'POST',
        body: validCabinPayload({ discount: 200 }),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.details.discount[0]).toContain('Discount');
    });

    it('rejects an invalid status value', async () => {
      const request = createRequest('http://localhost:3000/api/cabins', {
        method: 'POST',
        body: validCabinPayload({ status: 'closed' }),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
    });

    it('persists optional fields added to reconcile with the Cabin model', async () => {
      const request = createRequest('http://localhost:3000/api/cabins', {
        method: 'POST',
        body: validCabinPayload({
          status: 'maintenance',
          minNights: 2,
          extraGuestFee: 15,
          images: ['https://example.com/gallery1.jpg'],
          bedrooms: 2,
          bathrooms: 1,
          size: 750,
        }),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.data.status).toBe('maintenance');
      expect(body.data.minNights).toBe(2);
      expect(body.data.extraGuestFee).toBe(15);
      expect(body.data.images).toEqual(['https://example.com/gallery1.jpg']);
    });
  });

  describe('PUT /api/cabins', () => {
    it('updates a cabin without resetting fields absent from the payload', async () => {
      const cabin = await Cabin.create(
        validCabinPayload({ status: 'maintenance', discount: 50 })
      );

      const request = createRequest('http://localhost:3000/api/cabins', {
        method: 'PUT',
        body: { _id: cabin._id.toString(), name: 'Renamed Cabin' },
      });

      const response = await PUT(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.name).toBe('Renamed Cabin');
      expect(body.data.status).toBe('maintenance');
      expect(body.data.discount).toBe(50);
    });

    it('rejects an update with discount above the (possibly updated) price', async () => {
      const cabin = await Cabin.create(validCabinPayload());

      const request = createRequest('http://localhost:3000/api/cabins', {
        method: 'PUT',
        body: { _id: cabin._id.toString(), price: 100, discount: 150 },
      });

      const response = await PUT(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
    });

    it('returns 404 when the cabin does not exist', async () => {
      const request = createRequest('http://localhost:3000/api/cabins', {
        method: 'PUT',
        body: { _id: '507f1f77bcf86cd799439011', name: 'Ghost Cabin' },
      });

      const response = await PUT(request);
      expect(response.status).toBe(404);
    });

    it('rejects a discount-only update that exceeds the stored price', async () => {
      const cabin = await Cabin.create(validCabinPayload({ price: 100 }));

      const request = createRequest('http://localhost:3000/api/cabins', {
        method: 'PUT',
        body: { _id: cabin._id.toString(), discount: 150 },
      });

      const response = await PUT(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
    });

    it('accepts a discount-only update within the stored price', async () => {
      const cabin = await Cabin.create(validCabinPayload({ price: 100 }));

      const request = createRequest('http://localhost:3000/api/cabins', {
        method: 'PUT',
        body: { _id: cabin._id.toString(), discount: 50 },
      });

      const response = await PUT(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.discount).toBe(50);
    });

    it('rejects a price-only update that drops below the stored discount', async () => {
      const cabin = await Cabin.create(
        validCabinPayload({ price: 100, discount: 80 })
      );

      const request = createRequest('http://localhost:3000/api/cabins', {
        method: 'PUT',
        body: { _id: cabin._id.toString(), price: 50 },
      });

      const response = await PUT(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
    });

    it('accepts a price-only update that stays above the stored discount', async () => {
      const cabin = await Cabin.create(
        validCabinPayload({ price: 100, discount: 80 })
      );

      const request = createRequest('http://localhost:3000/api/cabins', {
        method: 'PUT',
        body: { _id: cabin._id.toString(), price: 200 },
      });

      const response = await PUT(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.price).toBe(200);
    });
  });

  describe('GET /api/cabins/[id]', () => {
    it('returns a cabin by id', async () => {
      const cabin = await Cabin.create(validCabinPayload());

      const request = createRequest(
        `http://localhost:3000/api/cabins/${cabin._id}`
      );
      const response = await getById(request, {
        params: Promise.resolve({ id: cabin._id.toString() }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.name).toBe('Lakeside Cabin');
    });
  });

  describe('PUT /api/cabins/[id]', () => {
    it('updates a cabin by id without resetting absent fields', async () => {
      const cabin = await Cabin.create(
        validCabinPayload({ amenities: ['wifi'], extraGuestFee: 20 })
      );

      const request = createRequest(
        `http://localhost:3000/api/cabins/${cabin._id}`,
        { method: 'PUT', body: { price: 250 } }
      );
      const response = await updateById(request, {
        params: Promise.resolve({ id: cabin._id.toString() }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.price).toBe(250);
      expect(body.data.amenities).toEqual(['wifi']);
      expect(body.data.extraGuestFee).toBe(20);
    });

    it('rejects an invalid image URL on update', async () => {
      const cabin = await Cabin.create(validCabinPayload());

      const request = createRequest(
        `http://localhost:3000/api/cabins/${cabin._id}`,
        { method: 'PUT', body: { image: 'not-a-url' } }
      );
      const response = await updateById(request, {
        params: Promise.resolve({ id: cabin._id.toString() }),
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
    });

    it('rejects a discount-only update that exceeds the stored price', async () => {
      const cabin = await Cabin.create(validCabinPayload({ price: 100 }));

      const request = createRequest(
        `http://localhost:3000/api/cabins/${cabin._id}`,
        { method: 'PUT', body: { discount: 150 } }
      );
      const response = await updateById(request, {
        params: Promise.resolve({ id: cabin._id.toString() }),
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
    });

    it('rejects a price-only update that drops below the stored discount', async () => {
      const cabin = await Cabin.create(
        validCabinPayload({ price: 100, discount: 80 })
      );

      const request = createRequest(
        `http://localhost:3000/api/cabins/${cabin._id}`,
        { method: 'PUT', body: { price: 50 } }
      );
      const response = await updateById(request, {
        params: Promise.resolve({ id: cabin._id.toString() }),
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
    });
  });
});
