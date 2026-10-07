/**
 * @jest-environment node
 */

import { Error as MongooseError } from 'mongoose';

import mongoose, { Types } from 'mongoose';
import type { ExperienceJsonSource } from '@lodgeflow/database/experience-json';
import type { ApiAuthResult } from '@/lib/api-utils';
import { NextRequest } from 'next/server';
jest.mock('@lodgeflow/database/reservation-capacity', () => ({
  ...jest.requireActual('@lodgeflow/database/reservation-capacity'),
  updateCapacityCatalog: jest.fn(),
  deleteCapacityCatalog: jest.fn(),
}));
import {
  updateCapacityCatalog,
  deleteCapacityCatalog,
} from '@lodgeflow/database/reservation-capacity';
const mockUpdate = updateCapacityCatalog as jest.Mock;
const mockDelete = deleteCapacityCatalog as jest.Mock;

import { GET, POST } from '@/app/api/experiences/route';
import { GET as getById, PUT, DELETE } from '@/app/api/experiences/[id]/route';
import connectToDatabase from '@lodgeflow/database/mongodb';

// Mock the database connection
jest.mock('@lodgeflow/database/mongodb');
const mockConnectToDatabase = connectToDatabase as jest.MockedFunction<
  typeof connectToDatabase
>;

const mockExperienceModel = { find: jest.fn(), findById: jest.fn() };
const mockExperienceConstructor = jest.fn<
  ExperienceJsonSource & { save: () => Promise<unknown> },
  [unknown]
>();
jest.mock('@lodgeflow/database/models/Experience', () => ({
  Experience: Object.assign(
    function Experience(input: unknown) {
      return mockExperienceConstructor(input);
    },
    {
      find: (...args: unknown[]) => mockExperienceModel.find(...args),
      findById: (...args: unknown[]) => mockExperienceModel.findById(...args),
    }
  ),
}));

// Mock auth to bypass authentication
jest.mock('@/lib/api-utils', () => ({
  ...jest.requireActual('@/lib/api-utils'),
  requireApiAuth: jest.fn().mockResolvedValue({
    authenticated: true,
    userId: 'test-user-id',
    role: 'admin',
  } satisfies ApiAuthResult),
}));

// Mock data
const mockExperienceData: ExperienceJsonSource = {
  _id: new Types.ObjectId('507f1f77bcf86cd799439011'),
  name: 'Mountain Hiking Adventure',
  price: 299,
  duration: '4 hours',
  difficulty: 'Moderate' as const,
  category: 'Adventure',
  description: 'Experience the thrill of mountain hiking',
  image: '/images/hiking.jpg',
  includes: ['Guide', 'Equipment', 'Snacks'],
  available: ['2024-06-01', '2024-06-15'],
  ctaText: 'Book Now',
  isPopular: true,
  maxParticipants: 12,
  minAge: 16,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
};

const mockExperienceList = [
  mockExperienceData,
  {
    ...mockExperienceData,
    _id: new Types.ObjectId('507f1f77bcf86cd799439012'),
    name: 'River Rafting',
    price: 199,
    category: 'Water Sports',
  },
];

describe('/api/experiences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnectToDatabase.mockResolvedValue(mongoose);
  });

  describe('GET /api/experiences', () => {
    it('should return all experiences', async () => {
      // Mock Experience.find to return mock data with sort chaining
      mockExperienceModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockExperienceList),
      });

      const request = new NextRequest('http://localhost/api/experiences');
      const response = await GET(request);
      const data = await response.json();

      expect(mockConnectToDatabase).toHaveBeenCalledTimes(1);
      expect(mockExperienceModel.find).toHaveBeenCalledWith({});
      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        data: JSON.parse(JSON.stringify(mockExperienceList)),
      });
    });

    it('should handle database errors', async () => {
      mockExperienceModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockRejectedValue(new Error('Database error')),
      });

      const request = new NextRequest('http://localhost/api/experiences');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        success: false,
        error: 'Failed to fetch experiences',
      });
    });
  });

  describe('POST /api/experiences', () => {
    it('should create a new experience', async () => {
      const mockSave = jest.fn().mockResolvedValue(mockExperienceData);
      mockExperienceConstructor.mockImplementation(() => ({
        ...mockExperienceData,
        save: mockSave,
      }));

      const request = new NextRequest('http://localhost/api/experiences', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Mountain Hiking Adventure',
          price: 299,
          duration: '4 hours',
          difficulty: 'Moderate',
          category: 'Adventure',
          description: 'Experience the thrill of mountain hiking',
          image: '/images/hiking.jpg',
          includes: ['Guide', 'Equipment', 'Snacks'],
          available: ['2024-06-01', '2024-06-15'],
          ctaText: 'Book Now',
          isPopular: true,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(mockConnectToDatabase).toHaveBeenCalledTimes(1);
      expect(mockExperienceConstructor).toHaveBeenCalledWith({
        name: 'Mountain Hiking Adventure',
        price: 299,
        duration: '4 hours',
        difficulty: 'Moderate',
        category: 'Adventure',
        description: 'Experience the thrill of mountain hiking',
        image: '/images/hiking.jpg',
        includes: ['Guide', 'Equipment', 'Snacks'],
        available: ['2024-06-01', '2024-06-15'],
        ctaText: 'Book Now',
        isPopular: true,
        reviewCount: 0,
      });
      expect(mockSave).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data).toMatchObject({
        name: mockExperienceData.name,
        price: mockExperienceData.price,
      });
    });

    it('should reject an incomplete payload with a validation error', async () => {
      const request = new NextRequest('http://localhost/api/experiences', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Experience' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should handle creation errors', async () => {
      mockExperienceConstructor.mockImplementation(() => ({
        ...mockExperienceData,
        save: jest.fn().mockRejectedValue(new Error('Validation error')),
      }));

      const request = new NextRequest('http://localhost/api/experiences', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Mountain Hiking Adventure',
          price: 299,
          duration: '4 hours',
          difficulty: 'Moderate',
          category: 'Adventure',
          description: 'Experience the thrill of mountain hiking',
          image: '/images/hiking.jpg',
          includes: ['Guide', 'Equipment', 'Snacks'],
          available: ['2024-06-01', '2024-06-15'],
          ctaText: 'Book Now',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        success: false,
        error: 'Failed to create experience',
      });
    });

    it('should handle invalid JSON', async () => {
      const request = new NextRequest('http://localhost/api/experiences', {
        method: 'POST',
        body: 'invalid json',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        success: false,
        error: 'Invalid JSON body',
      });
    });

    it('maps a Mongoose ValidationError to a 400 response', async () => {
      const validationError = new MongooseError.ValidationError();
      validationError.addError(
        'price',
        new MongooseError.ValidatorError({
          path: 'price',
          message: 'Price cannot be negative',
        })
      );
      mockExperienceConstructor.mockImplementation(() => ({
        ...mockExperienceData,
        save: jest.fn().mockRejectedValue(validationError),
      }));

      const request = new NextRequest('http://localhost/api/experiences', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Mountain Hiking Adventure',
          price: 299,
          duration: '4 hours',
          difficulty: 'Moderate',
          category: 'Adventure',
          description: 'Experience the thrill of mountain hiking',
          image: '/images/hiking.jpg',
          includes: ['Guide', 'Equipment', 'Snacks'],
          available: ['2024-06-01', '2024-06-15'],
          ctaText: 'Book Now',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Validation failed');
      expect(data.details).toEqual({
        price: { message: 'Invalid value', path: 'price' },
      });
    });
  });
});

describe('/api/experiences/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnectToDatabase.mockResolvedValue(mongoose);
  });

  describe('GET /api/experiences/[id]', () => {
    it('should return a specific experience', async () => {
      mockExperienceModel.findById = jest
        .fn()
        .mockResolvedValue(mockExperienceData);

      const request = new NextRequest(
        'http://localhost/api/experiences/507f1f77bcf86cd799439011'
      );
      const params = Promise.resolve({ id: '507f1f77bcf86cd799439011' });

      const response = await getById(request, { params });
      const data = await response.json();

      expect(mockConnectToDatabase).toHaveBeenCalledTimes(1);
      expect(mockExperienceModel.findById).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011'
      );
      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        data: JSON.parse(JSON.stringify(mockExperienceData)),
      });
    });

    it('should return 404 when experience not found', async () => {
      mockExperienceModel.findById = jest.fn().mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost/api/experiences/507f1f77bcf86cd7994390ff'
      );
      const params = Promise.resolve({ id: '507f1f77bcf86cd7994390ff' });

      const response = await getById(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({ success: false, error: 'Experience not found' });
    });

    it('should handle database errors', async () => {
      mockExperienceModel.findById = jest
        .fn()
        .mockRejectedValue(new Error('Database error'));

      const request = new NextRequest(
        'http://localhost/api/experiences/507f1f77bcf86cd799439011'
      );
      const params = Promise.resolve({ id: '507f1f77bcf86cd799439011' });

      const response = await getById(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        success: false,
        error: 'Failed to fetch experience',
      });
    });
  });

  describe('PUT /api/experiences/[id]', () => {
    it('should update an existing experience', async () => {
      const updatedData = { ...mockExperienceData, name: 'Updated Adventure' };
      mockUpdate.mockResolvedValue(updatedData);

      const request = new NextRequest(
        'http://localhost/api/experiences/507f1f77bcf86cd799439011',
        {
          method: 'PUT',
          body: JSON.stringify({ name: 'Updated Adventure' }),
        }
      );
      const params = Promise.resolve({ id: '507f1f77bcf86cd799439011' });

      const response = await PUT(request, { params });
      const data = await response.json();

      expect(mockConnectToDatabase).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledWith({
        kind: 'experience',
        listingId: '507f1f77bcf86cd799439011',
        updates: { name: 'Updated Adventure' },
      });
      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        data: JSON.parse(JSON.stringify(updatedData)),
      });
    });

    it('rejects round-tripped server metadata', async () => {
      const updatedData = { ...mockExperienceData, name: 'Updated Adventure' };
      mockUpdate.mockResolvedValue(updatedData);

      const request = new NextRequest(
        'http://localhost/api/experiences/507f1f77bcf86cd799439011',
        {
          method: 'PUT',
          body: JSON.stringify({
            ...mockExperienceData,
            name: 'Updated Adventure',
          }),
        }
      );
      const params = Promise.resolve({ id: '507f1f77bcf86cd799439011' });

      const response = await PUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toMatchObject({
        success: false,
        error: 'Validation failed',
      });
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('should return 404 when updating non-existent experience', async () => {
      mockUpdate.mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost/api/experiences/507f1f77bcf86cd7994390ff',
        {
          method: 'PUT',
          body: JSON.stringify({ name: 'Updated Adventure' }),
        }
      );
      const params = Promise.resolve({ id: '507f1f77bcf86cd7994390ff' });

      const response = await PUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({ success: false, error: 'Experience not found' });
    });

    it('should handle update errors', async () => {
      mockUpdate.mockRejectedValue(new Error('Update error'));

      const request = new NextRequest(
        'http://localhost/api/experiences/507f1f77bcf86cd799439011',
        {
          method: 'PUT',
          body: JSON.stringify({ name: 'Updated Adventure' }),
        }
      );
      const params = Promise.resolve({ id: '507f1f77bcf86cd799439011' });

      const response = await PUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        success: false,
        error: 'Failed to update experience',
      });
    });

    it('should handle invalid JSON in PUT request', async () => {
      const request = new NextRequest(
        'http://localhost/api/experiences/507f1f77bcf86cd799439011',
        {
          method: 'PUT',
          body: 'invalid json',
        }
      );
      const params = Promise.resolve({ id: '507f1f77bcf86cd799439011' });

      const response = await PUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        success: false,
        error: 'Invalid JSON body',
      });
    });
  });

  describe('DELETE /api/experiences/[id]', () => {
    it('should delete an existing experience', async () => {
      mockDelete.mockResolvedValue(mockExperienceData);

      const request = new NextRequest(
        'http://localhost/api/experiences/507f1f77bcf86cd799439011',
        {
          method: 'DELETE',
        }
      );
      const params = Promise.resolve({ id: '507f1f77bcf86cd799439011' });

      const response = await DELETE(request, { params });
      const data = await response.json();

      expect(mockConnectToDatabase).toHaveBeenCalledTimes(1);
      expect(mockDelete).toHaveBeenCalledWith({
        kind: 'experience',
        listingId: '507f1f77bcf86cd799439011',
      });
      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        data: null,
        message: 'Experience deleted successfully',
      });
    });

    it('should return 404 when deleting non-existent experience', async () => {
      mockDelete.mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost/api/experiences/507f1f77bcf86cd7994390ff',
        {
          method: 'DELETE',
        }
      );
      const params = Promise.resolve({ id: '507f1f77bcf86cd7994390ff' });

      const response = await DELETE(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({ success: false, error: 'Experience not found' });
    });

    it('should handle deletion errors', async () => {
      mockDelete.mockRejectedValue(new Error('Delete error'));

      const request = new NextRequest(
        'http://localhost/api/experiences/507f1f77bcf86cd799439011',
        {
          method: 'DELETE',
        }
      );
      const params = Promise.resolve({ id: '507f1f77bcf86cd799439011' });

      const response = await DELETE(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        success: false,
        error: 'Failed to delete experience',
      });
    });
  });
});
