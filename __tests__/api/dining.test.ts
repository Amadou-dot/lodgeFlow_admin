/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET, POST, PUT, DELETE } from '@/app/api/dining/route';
import {
  GET as getById,
  PUT as updateById,
  DELETE as deleteById,
} from '@/app/api/dining/[id]/route';
import connectToDatabase from '@/lib/mongodb';

// Mock the database connection
jest.mock('@/lib/mongodb');
const mockConnectToDatabase = connectToDatabase as jest.MockedFunction<
  typeof connectToDatabase
>;

// Mock the Dining model (default export)
const mockDiningModel = {
  find: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
};

jest.mock('@/models/Dining', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    save: jest.fn(),
  })),
}));

// Get the mocked module
import Dining from '@/models/Dining';
const MockDining = Dining as jest.MockedFunction<typeof Dining> &
  typeof mockDiningModel;

// Mock auth to bypass authentication
jest.mock('@/lib/api-utils', () => ({
  ...jest.requireActual('@/lib/api-utils'),
  requireApiAuth: jest.fn().mockResolvedValue({
    authenticated: true,
    userId: 'test-user-id',
  }),
  escapeRegex: jest.fn((str: string) =>
    str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  ),
}));

// Mock dining data
const mockDiningData = {
  _id: '507f1f77bcf86cd799439011',
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
  minPeople: 1,
  image: 'https://example.com/breakfast.jpg',
  ingredients: ['eggs', 'bacon', 'toast'],
  allergens: ['gluten', 'dairy'],
  isAvailable: true,
  isPopular: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const mockDiningList = [
  mockDiningData,
  {
    ...mockDiningData,
    _id: '507f1f77bcf86cd799439012',
    name: 'Lunch Special',
    mealType: 'lunch',
    price: 35,
  },
];

describe('/api/dining', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnectToDatabase.mockResolvedValue(
      {} as ReturnType<typeof connectToDatabase>
    );
    // Set up static method mocks on the constructor
    Object.assign(MockDining, mockDiningModel);
  });

  describe('GET /api/dining', () => {
    it('should return all dining items', async () => {
      const mockSort = jest.fn().mockResolvedValue(mockDiningList);
      mockDiningModel.find.mockReturnValue({ sort: mockSort });

      const request = new NextRequest('http://localhost/api/dining');
      const response = await GET(request);
      const data = await response.json();

      expect(mockConnectToDatabase).toHaveBeenCalledTimes(1);
      expect(mockDiningModel.find).toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(2);
    });

    it('should filter by type', async () => {
      const mockSort = jest.fn().mockResolvedValue([mockDiningData]);
      mockDiningModel.find.mockReturnValue({ sort: mockSort });

      const request = new NextRequest('http://localhost/api/dining?type=menu');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockDiningModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'menu',
        })
      );
    });

    it('should filter by mealType', async () => {
      const mockSort = jest.fn().mockResolvedValue([mockDiningData]);
      mockDiningModel.find.mockReturnValue({ sort: mockSort });

      const request = new NextRequest(
        'http://localhost/api/dining?mealType=breakfast'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockDiningModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          mealType: 'breakfast',
        })
      );
    });

    it('should filter by availability', async () => {
      const mockSort = jest.fn().mockResolvedValue([mockDiningData]);
      mockDiningModel.find.mockReturnValue({ sort: mockSort });

      const request = new NextRequest(
        'http://localhost/api/dining?isAvailable=true'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockDiningModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          isAvailable: true,
        })
      );
    });

    it('should sort by price', async () => {
      const mockSort = jest.fn().mockResolvedValue(mockDiningList);
      mockDiningModel.find.mockReturnValue({ sort: mockSort });

      const request = new NextRequest(
        'http://localhost/api/dining?sortBy=price&sortOrder=asc'
      );
      const response = await GET(request);

      expect(mockSort).toHaveBeenCalledWith({ price: 1 });
      expect(response.status).toBe(200);
    });

    it('should handle database errors', async () => {
      mockDiningModel.find.mockReturnValue({
        sort: jest.fn().mockRejectedValue(new Error('Database error')),
      });

      const request = new NextRequest('http://localhost/api/dining');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });

  describe('POST /api/dining', () => {
    const validDiningPayload = {
      name: 'Test Item',
      description: 'A test dining item description.',
      type: 'menu',
      mealType: 'breakfast',
      category: 'regular',
      price: 25,
      servingTime: { start: '07:00', end: '10:30' },
      maxPeople: 50,
      image: 'https://example.com/test.jpg',
    };

    it('should reject invalid serving time format', async () => {
      const request = new NextRequest('http://localhost/api/dining', {
        method: 'POST',
        body: JSON.stringify({
          ...validDiningPayload,
          servingTime: { start: '7:00 AM', end: '10:30 AM' },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should reject an invalid type/mealType/category combination', async () => {
      const request = new NextRequest('http://localhost/api/dining', {
        method: 'POST',
        body: JSON.stringify({
          ...validDiningPayload,
          type: 'breakfast',
          mealType: 'vegetarian',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.details.type).toBeDefined();
      expect(data.details.mealType).toBeDefined();
    });

    it('should create a dining item with valid data', async () => {
      const request = new NextRequest('http://localhost/api/dining', {
        method: 'POST',
        body: JSON.stringify(validDiningPayload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
    });
  });

  describe('PUT /api/dining', () => {
    it('should update a dining item', async () => {
      const updatedDining = { ...mockDiningData, price: 30 };
      mockDiningModel.findByIdAndUpdate.mockResolvedValue(updatedDining);

      const request = new NextRequest('http://localhost/api/dining', {
        method: 'PUT',
        body: JSON.stringify({
          _id: '507f1f77bcf86cd799439011',
          price: 30,
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(mockConnectToDatabase).toHaveBeenCalledTimes(1);
      expect(mockDiningModel.findByIdAndUpdate).toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return 404 when item not found', async () => {
      mockDiningModel.findByIdAndUpdate.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/dining', {
        method: 'PUT',
        body: JSON.stringify({
          _id: 'nonexistent',
          price: 30,
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });
  });

  describe('DELETE /api/dining', () => {
    it('should delete a dining item', async () => {
      mockDiningModel.findByIdAndDelete.mockResolvedValue(mockDiningData);

      const request = new NextRequest(
        'http://localhost/api/dining?id=507f1f77bcf86cd799439011',
        {
          method: 'DELETE',
        }
      );

      const response = await DELETE(request);
      const data = await response.json();

      expect(mockConnectToDatabase).toHaveBeenCalledTimes(1);
      expect(mockDiningModel.findByIdAndDelete).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011'
      );
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return 404 when item not found', async () => {
      mockDiningModel.findByIdAndDelete.mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost/api/dining?id=nonexistent',
        {
          method: 'DELETE',
        }
      );

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });
  });
});

describe('/api/dining/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnectToDatabase.mockResolvedValue(
      {} as ReturnType<typeof connectToDatabase>
    );
    Object.assign(MockDining, mockDiningModel);
  });

  describe('GET /api/dining/[id]', () => {
    it('should return a specific dining item', async () => {
      mockDiningModel.findById.mockResolvedValue(mockDiningData);

      const request = new NextRequest(
        'http://localhost/api/dining/507f1f77bcf86cd799439011'
      );
      const params = Promise.resolve({ id: '507f1f77bcf86cd799439011' });

      const response = await getById(request, { params });
      const data = await response.json();

      expect(mockConnectToDatabase).toHaveBeenCalledTimes(1);
      expect(mockDiningModel.findById).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011'
      );
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return 404 when item not found', async () => {
      mockDiningModel.findById.mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost/api/dining/nonexistent'
      );
      const params = Promise.resolve({ id: 'nonexistent' });

      const response = await getById(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });
  });

  describe('PUT /api/dining/[id]', () => {
    it('should update a dining item by ID', async () => {
      const updatedDining = { ...mockDiningData, isAvailable: false };
      mockDiningModel.findByIdAndUpdate.mockResolvedValue(updatedDining);

      const request = new NextRequest(
        'http://localhost/api/dining/507f1f77bcf86cd799439011',
        {
          method: 'PUT',
          body: JSON.stringify({ isAvailable: false }),
        }
      );
      const params = Promise.resolve({ id: '507f1f77bcf86cd799439011' });

      const response = await updateById(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should reject invalid serving time format', async () => {
      const request = new NextRequest(
        'http://localhost/api/dining/507f1f77bcf86cd799439011',
        {
          method: 'PUT',
          body: JSON.stringify({
            servingTime: { start: '7 AM', end: '10 AM' },
          }),
        }
      );
      const params = Promise.resolve({ id: '507f1f77bcf86cd799439011' });

      const response = await updateById(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe('DELETE /api/dining/[id]', () => {
    it('should delete a dining item by ID', async () => {
      mockDiningModel.findByIdAndDelete.mockResolvedValue(mockDiningData);

      const request = new NextRequest(
        'http://localhost/api/dining/507f1f77bcf86cd799439011',
        {
          method: 'DELETE',
        }
      );
      const params = Promise.resolve({ id: '507f1f77bcf86cd799439011' });

      const response = await deleteById(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return 404 when item not found', async () => {
      mockDiningModel.findByIdAndDelete.mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost/api/dining/nonexistent',
        {
          method: 'DELETE',
        }
      );
      const params = Promise.resolve({ id: 'nonexistent' });

      const response = await deleteById(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });
  });
});
