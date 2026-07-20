/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET, POST, PUT, DELETE } from '@/app/api/cabins/route';
import {
  GET as getById,
  PUT as updateById,
  DELETE as deleteById,
} from '@/app/api/cabins/[id]/route';
import connectToDatabase from '@/lib/mongodb';

// Mock the database connection
jest.mock('@/lib/mongodb');
const mockConnectToDatabase = connectToDatabase as jest.MockedFunction<
  typeof connectToDatabase
>;

// Mock the Cabin model (default export)
const mockCabinModel = {
  find: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
  create: jest.fn(),
};

jest.mock('@/models/Cabin', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    save: jest.fn(),
  })),
}));

// Get the mocked module
import Cabin from '@/models/Cabin';
const MockCabin = Cabin as jest.MockedFunction<typeof Cabin> &
  typeof mockCabinModel;

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

// Mock cabin data
const mockCabinData = {
  _id: '507f1f77bcf86cd799439011',
  name: 'Lakeside Cabin',
  description: 'A beautiful cabin by the lake with stunning views.',
  capacity: 4,
  price: 200,
  discount: 20,
  image: 'https://example.com/cabin.jpg',
  amenities: {
    wifi: true,
    tv: true,
    airConditioning: true,
    heating: true,
  },
  isAvailable: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const mockCabinList = [
  mockCabinData,
  {
    ...mockCabinData,
    _id: '507f1f77bcf86cd799439012',
    name: 'Mountain Retreat',
    price: 300,
    capacity: 6,
  },
];

describe('/api/cabins', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnectToDatabase.mockResolvedValue(
      {} as ReturnType<typeof connectToDatabase>
    );
    Object.assign(MockCabin, mockCabinModel);
  });

  describe('GET /api/cabins', () => {
    it('should return all cabins', async () => {
      const mockSort = jest.fn().mockResolvedValue(mockCabinList);
      mockCabinModel.find.mockReturnValue({ sort: mockSort });

      const request = new NextRequest('http://localhost/api/cabins');
      const response = await GET(request);
      const data = await response.json();

      expect(mockConnectToDatabase).toHaveBeenCalledTimes(1);
      expect(mockCabinModel.find).toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(2);
    });

    it('should filter by capacity (small)', async () => {
      const mockSort = jest.fn().mockResolvedValue([mockCabinData]);
      mockCabinModel.find.mockReturnValue({ sort: mockSort });

      const request = new NextRequest(
        'http://localhost/api/cabins?capacity=small'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockCabinModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          capacity: { $lte: 3 },
        })
      );
    });

    it('should filter by discount', async () => {
      const mockSort = jest.fn().mockResolvedValue([mockCabinData]);
      mockCabinModel.find.mockReturnValue({ sort: mockSort });

      const request = new NextRequest(
        'http://localhost/api/cabins?discount=with'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockCabinModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          discount: { $gt: 0 },
        })
      );
    });

    it('should sort by price ascending', async () => {
      const mockSort = jest.fn().mockResolvedValue(mockCabinList);
      mockCabinModel.find.mockReturnValue({ sort: mockSort });

      const request = new NextRequest(
        'http://localhost/api/cabins?sortBy=price&sortOrder=asc'
      );
      const response = await GET(request);

      expect(mockSort).toHaveBeenCalledWith({ price: 1 });
      expect(response.status).toBe(200);
    });

    it('should handle database errors', async () => {
      mockCabinModel.find.mockReturnValue({
        sort: jest.fn().mockRejectedValue(new Error('Database error')),
      });

      const request = new NextRequest('http://localhost/api/cabins');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });

  describe('POST /api/cabins', () => {
    const validCabinPayload = {
      name: 'Test Cabin',
      description: 'A test cabin description here.',
      capacity: 4,
      price: 100,
      image: 'https://example.com/cabin.jpg',
    };

    it('should reject discount greater than price', async () => {
      const request = new NextRequest('http://localhost/api/cabins', {
        method: 'POST',
        body: JSON.stringify({ ...validCabinPayload, discount: 150 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Validation failed');
      expect(data.details.discount[0]).toContain('Discount');
    });

    it('should reject a missing required field', async () => {
      const { image: _image, ...payload } = validCabinPayload;
      const request = new NextRequest('http://localhost/api/cabins', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.details.image).toBeDefined();
    });

    it('should create a cabin with valid data', async () => {
      const createdCabin = { ...mockCabinData, ...validCabinPayload };
      mockCabinModel.create.mockResolvedValue(createdCabin);

      const request = new NextRequest('http://localhost/api/cabins', {
        method: 'POST',
        body: JSON.stringify(validCabinPayload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(mockCabinModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Cabin',
          status: 'active',
          discount: 0,
        })
      );
      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
    });

    it('maps a Mongoose ValidationError to a 400 response', async () => {
      const validationError = Object.assign(
        new Error('Cabin validation failed'),
        {
          name: 'ValidationError',
          errors: {
            image: { message: 'Please provide a valid image URL' },
          },
        }
      );
      mockCabinModel.create.mockRejectedValue(validationError);

      const request = new NextRequest('http://localhost/api/cabins', {
        method: 'POST',
        body: JSON.stringify(validCabinPayload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Validation failed');
      expect(data.details).toEqual(validationError.errors);
    });
  });

  describe('PUT /api/cabins', () => {
    it('should update an existing cabin', async () => {
      const updatedCabin = { ...mockCabinData, name: 'Updated Cabin' };
      mockCabinModel.findByIdAndUpdate.mockResolvedValue(updatedCabin);

      const request = new NextRequest('http://localhost/api/cabins', {
        method: 'PUT',
        body: JSON.stringify({
          _id: '507f1f77bcf86cd799439011',
          name: 'Updated Cabin',
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(mockConnectToDatabase).toHaveBeenCalledTimes(1);
      expect(mockCabinModel.findByIdAndUpdate).toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return 404 when cabin not found', async () => {
      mockCabinModel.findByIdAndUpdate.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/cabins', {
        method: 'PUT',
        body: JSON.stringify({
          _id: 'nonexistent',
          name: 'Updated Cabin',
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });
  });

  describe('DELETE /api/cabins', () => {
    it('should delete a cabin', async () => {
      mockCabinModel.findByIdAndDelete.mockResolvedValue(mockCabinData);

      const request = new NextRequest(
        'http://localhost/api/cabins?id=507f1f77bcf86cd799439011',
        {
          method: 'DELETE',
        }
      );

      const response = await DELETE(request);
      const data = await response.json();

      expect(mockConnectToDatabase).toHaveBeenCalledTimes(1);
      expect(mockCabinModel.findByIdAndDelete).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011'
      );
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return 404 when cabin not found', async () => {
      mockCabinModel.findByIdAndDelete.mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost/api/cabins?id=nonexistent',
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

describe('/api/cabins/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnectToDatabase.mockResolvedValue(
      {} as ReturnType<typeof connectToDatabase>
    );
    Object.assign(MockCabin, mockCabinModel);
  });

  describe('GET /api/cabins/[id]', () => {
    it('should return a specific cabin', async () => {
      mockCabinModel.findById.mockResolvedValue(mockCabinData);

      const request = new NextRequest(
        'http://localhost/api/cabins/507f1f77bcf86cd799439011'
      );
      const params = Promise.resolve({ id: '507f1f77bcf86cd799439011' });

      const response = await getById(request, { params });
      const data = await response.json();

      expect(mockConnectToDatabase).toHaveBeenCalledTimes(1);
      expect(mockCabinModel.findById).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011'
      );
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return 404 when cabin not found', async () => {
      mockCabinModel.findById.mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost/api/cabins/nonexistent'
      );
      const params = Promise.resolve({ id: 'nonexistent' });

      const response = await getById(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });

    it('should handle database errors', async () => {
      mockCabinModel.findById.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest(
        'http://localhost/api/cabins/507f1f77bcf86cd799439011'
      );
      const params = Promise.resolve({ id: '507f1f77bcf86cd799439011' });

      const response = await getById(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });

  describe('PUT /api/cabins/[id]', () => {
    it('should update a cabin by ID', async () => {
      const updatedCabin = { ...mockCabinData, price: 250 };
      // Route first calls findById to check current values
      mockCabinModel.findById.mockResolvedValue(mockCabinData);
      mockCabinModel.findByIdAndUpdate.mockResolvedValue(updatedCabin);

      const request = new NextRequest(
        'http://localhost/api/cabins/507f1f77bcf86cd799439011',
        {
          method: 'PUT',
          body: JSON.stringify({ price: 250 }),
        }
      );
      const params = Promise.resolve({ id: '507f1f77bcf86cd799439011' });

      const response = await updateById(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should reject invalid discount/price combination', async () => {
      // Route first calls findById to check current values
      mockCabinModel.findById.mockResolvedValue(mockCabinData);

      const request = new NextRequest(
        'http://localhost/api/cabins/507f1f77bcf86cd799439011',
        {
          method: 'PUT',
          body: JSON.stringify({ price: 100, discount: 150 }),
        }
      );
      const params = Promise.resolve({ id: '507f1f77bcf86cd799439011' });

      const response = await updateById(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe('DELETE /api/cabins/[id]', () => {
    it('should delete a cabin by ID', async () => {
      mockCabinModel.findByIdAndDelete.mockResolvedValue(mockCabinData);

      const request = new NextRequest(
        'http://localhost/api/cabins/507f1f77bcf86cd799439011',
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

    it('should return 404 when cabin not found', async () => {
      mockCabinModel.findByIdAndDelete.mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost/api/cabins/nonexistent',
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
