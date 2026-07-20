import { NextRequest } from 'next/server';

jest.mock('@/lib/mongodb', () => jest.fn().mockResolvedValue(undefined));

import { GET, POST, PUT } from '@/app/api/dining/route';
import { GET as getById, PUT as updateById } from '@/app/api/dining/[id]/route';
import Dining from '@/models/Dining';

function createRequest(url: string, options?: { method?: string; body?: any }) {
  const init: RequestInit = { method: options?.method || 'GET' };
  if (options?.body) {
    init.body = JSON.stringify(options.body);
    init.headers = { 'Content-Type': 'application/json' };
  }
  return new NextRequest(new URL(url, 'http://localhost:3000'), init);
}

function validDiningPayload(overrides: Record<string, any> = {}) {
  return {
    name: 'Continental Breakfast',
    description:
      'A delicious continental breakfast with fresh pastries and coffee.',
    type: 'menu',
    mealType: 'breakfast',
    category: 'regular',
    price: 25,
    servingTime: { start: '07:00', end: '10:30' },
    maxPeople: 50,
    image: 'https://example.com/breakfast.jpg',
    ...overrides,
  };
}

describe('Dining API Routes', () => {
  describe('GET /api/dining', () => {
    it('returns dining items from the database', async () => {
      await Dining.create(validDiningPayload());

      const request = createRequest('http://localhost:3000/api/dining');
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
    });
  });

  describe('POST /api/dining', () => {
    it('creates a dining item with a valid payload and applies schema defaults', async () => {
      const request = createRequest('http://localhost:3000/api/dining', {
        method: 'POST',
        body: validDiningPayload(),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.isAvailable).toBe(true);
      expect(body.data.minPeople).toBe(1);

      const stored = await Dining.findById(body.data._id);
      expect(stored).not.toBeNull();
    });

    it('rejects a payload with a type/mealType/category that does not match the model enums', async () => {
      const request = createRequest('http://localhost:3000/api/dining', {
        method: 'POST',
        body: validDiningPayload({ type: 'breakfast', mealType: 'vegetarian' }),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.details.type).toBeDefined();
      expect(body.details.mealType).toBeDefined();

      const count = await Dining.countDocuments();
      expect(count).toBe(0);
    });

    it('rejects an invalid serving time format', async () => {
      const request = createRequest('http://localhost:3000/api/dining', {
        method: 'POST',
        body: validDiningPayload({
          servingTime: { start: '7:00 AM', end: '10:00 AM' },
        }),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
    });

    it('persists beverages and dietary options added to reconcile with the Dining model', async () => {
      const request = createRequest('http://localhost:3000/api/dining', {
        method: 'POST',
        body: validDiningPayload({
          dietary: ['vegetarian', 'gluten-free'],
          beverages: [{ name: 'House IPA', category: 'craft-beer', price: 8 }],
        }),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.data.dietary).toEqual(['vegetarian', 'gluten-free']);
      expect(body.data.beverages).toHaveLength(1);
      expect(body.data.beverages[0].name).toBe('House IPA');
    });
  });

  describe('PUT /api/dining', () => {
    it('updates a dining item without resetting fields absent from the payload', async () => {
      const dining = await Dining.create(
        validDiningPayload({ isPopular: true, minPeople: 3 })
      );

      const request = createRequest('http://localhost:3000/api/dining', {
        method: 'PUT',
        body: { _id: dining._id.toString(), price: 30 },
      });

      const response = await PUT(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.price).toBe(30);
      expect(body.data.isPopular).toBe(true);
      expect(body.data.minPeople).toBe(3);
    });

    it('returns 404 when the dining item does not exist', async () => {
      const request = createRequest('http://localhost:3000/api/dining', {
        method: 'PUT',
        body: { _id: '507f1f77bcf86cd799439011', price: 30 },
      });

      const response = await PUT(request);
      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/dining/[id]', () => {
    it('returns a dining item by id', async () => {
      const dining = await Dining.create(validDiningPayload());

      const request = createRequest(
        `http://localhost:3000/api/dining/${dining._id}`
      );
      const response = await getById(request, {
        params: Promise.resolve({ id: dining._id.toString() }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.name).toBe('Continental Breakfast');
    });
  });

  describe('PUT /api/dining/[id]', () => {
    it('updates a dining item by id without resetting absent fields', async () => {
      const dining = await Dining.create(
        validDiningPayload({ allergens: ['gluten'], isAvailable: false })
      );

      const request = createRequest(
        `http://localhost:3000/api/dining/${dining._id}`,
        { method: 'PUT', body: { price: 40 } }
      );
      const response = await updateById(request, {
        params: Promise.resolve({ id: dining._id.toString() }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.price).toBe(40);
      expect(body.data.allergens).toEqual(['gluten']);
      expect(body.data.isAvailable).toBe(false);
    });

    it('rejects an invalid category on update', async () => {
      const dining = await Dining.create(validDiningPayload());

      const request = createRequest(
        `http://localhost:3000/api/dining/${dining._id}`,
        { method: 'PUT', body: { category: 'invalid' } }
      );
      const response = await updateById(request, {
        params: Promise.resolve({ id: dining._id.toString() }),
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
    });
  });
});
