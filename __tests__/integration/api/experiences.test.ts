import { NextRequest } from 'next/server';

jest.mock('@/lib/mongodb', () => jest.fn().mockResolvedValue(undefined));

import { GET, POST } from '@/app/api/experiences/route';
import {
  GET as getById,
  PUT as updateById,
} from '@/app/api/experiences/[id]/route';
import { Experience } from '@/models/Experience';

function createRequest(url: string, options?: { method?: string; body?: any }) {
  const init: RequestInit = { method: options?.method || 'GET' };
  if (options?.body) {
    init.body = JSON.stringify(options.body);
    init.headers = { 'Content-Type': 'application/json' };
  }
  return new NextRequest(new URL(url, 'http://localhost:3000'), init);
}

function validExperiencePayload(overrides: Record<string, any> = {}) {
  return {
    name: 'Mountain Hiking Tour',
    description: 'An exciting hiking tour through scenic mountain trails.',
    duration: '4 hours',
    price: 75,
    difficulty: 'Moderate',
    category: 'Outdoor',
    image: 'https://example.com/tour.jpg',
    includes: ['Guide', 'Water'],
    available: ['Weekends', 'Weekdays'],
    ctaText: 'Book Now',
    ...overrides,
  };
}

// Mongoose collections are cleared after every test (see jest.setup.node.ts),
// but the model registry keeps a reference to the same connection.
afterEach(async () => {
  await Experience.deleteMany({});
});

describe('Experiences API Routes', () => {
  describe('GET /api/experiences', () => {
    it('returns experiences from the database', async () => {
      await Experience.create(validExperiencePayload());

      const request = createRequest('http://localhost:3000/api/experiences');
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
    });
  });

  describe('POST /api/experiences', () => {
    it('creates an experience with a valid payload and applies schema defaults', async () => {
      const request = createRequest('http://localhost:3000/api/experiences', {
        method: 'POST',
        body: validExperiencePayload(),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.isPopular).toBe(false);
      expect(body.data.reviewCount).toBe(0);

      const stored = await Experience.findById(body.data._id);
      expect(stored).not.toBeNull();
    });

    it('rejects a payload missing required fields', async () => {
      const { ctaText: _ctaText, ...payload } = validExperiencePayload();
      const request = createRequest('http://localhost:3000/api/experiences', {
        method: 'POST',
        body: payload,
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);

      const count = await Experience.countDocuments();
      expect(count).toBe(0);
    });

    it('rejects an invalid difficulty value', async () => {
      const request = createRequest('http://localhost:3000/api/experiences', {
        method: 'POST',
        body: validExperiencePayload({ difficulty: 'Extreme' }),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
    });

    it('silently strips unknown legacy keys', async () => {
      const request = createRequest('http://localhost:3000/api/experiences', {
        method: 'POST',
        body: { ...validExperiencePayload(), included: ['Legacy key'] },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data).not.toHaveProperty('included');
    });
  });

  describe('GET /api/experiences/[id]', () => {
    it('returns an experience by id', async () => {
      const experience = await Experience.create(validExperiencePayload());

      const request = createRequest(
        `http://localhost:3000/api/experiences/${experience._id}`
      );
      const response = await getById(request, {
        params: Promise.resolve({ id: experience._id.toString() }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Mountain Hiking Tour');
    });
  });

  describe('PUT /api/experiences/[id]', () => {
    it('updates an experience without resetting fields absent from the payload', async () => {
      const experience = await Experience.create(
        validExperiencePayload({ isPopular: true, reviewCount: 12 })
      );

      const request = createRequest(
        `http://localhost:3000/api/experiences/${experience._id}`,
        { method: 'PUT', body: { price: 100 } }
      );
      const response = await updateById(request, {
        params: Promise.resolve({ id: experience._id.toString() }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.price).toBe(100);
      expect(body.data.isPopular).toBe(true);
      expect(body.data.reviewCount).toBe(12);
    });

    it('accepts a full round-tripped payload including _id, createdAt, updatedAt', async () => {
      const experience = await Experience.create(validExperiencePayload());

      const request = createRequest(
        `http://localhost:3000/api/experiences/${experience._id}`,
        {
          method: 'PUT',
          body: {
            ...experience.toObject(),
            _id: experience._id.toString(),
            name: 'Updated via round trip',
          },
        }
      );
      const response = await updateById(request, {
        params: Promise.resolve({ id: experience._id.toString() }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Updated via round trip');
    });

    it('rejects an invalid difficulty value on update', async () => {
      const experience = await Experience.create(validExperiencePayload());

      const request = createRequest(
        `http://localhost:3000/api/experiences/${experience._id}`,
        { method: 'PUT', body: { difficulty: 'Extreme' } }
      );
      const response = await updateById(request, {
        params: Promise.resolve({ id: experience._id.toString() }),
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
    });

    it('returns 404 when the experience does not exist', async () => {
      const request = createRequest(
        'http://localhost:3000/api/experiences/507f1f77bcf86cd799439011',
        { method: 'PUT', body: { price: 100 } }
      );
      const response = await updateById(request, {
        params: Promise.resolve({ id: '507f1f77bcf86cd799439011' }),
      });

      expect(response.status).toBe(404);
    });
  });
});
