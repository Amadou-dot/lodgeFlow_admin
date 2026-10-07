/**
 * @jest-environment node
 */

import type { ApiAuthResult } from '@/lib/api-utils';
import { Types } from 'mongoose';
import mongoose from 'mongoose';
import type { SettingsJsonSource } from '@lodgeflow/database/settings-json';
import { NextRequest } from 'next/server';
import connectToDatabase from '@lodgeflow/database/mongodb';

// Mock the database connection
jest.mock('@lodgeflow/database/mongodb');

// Create mock save function
const mockSave = jest.fn();

// Mock the Settings model (default export) - must be defined before import
jest.mock('@lodgeflow/database/models/Settings', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
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

// Import after mocks are set up
import { GET, PUT } from '@/app/api/settings/route';
import Settings from '@lodgeflow/database/models/Settings';

const mockConnectToDatabase = connectToDatabase as jest.MockedFunction<
  typeof connectToDatabase
>;
const mockSettings = Settings as jest.Mocked<typeof Settings>;

// Mock settings data
const mockSettingsData = {
  _id: new Types.ObjectId('507f1f77bcf86cd799439011'),
  singleton: 'global',
  fullAddress: '',
  minBookingLength: 1,
  maxBookingLength: 30,
  maxGuestsPerBooking: 10,
  breakfastPrice: 15,
  checkInTime: '15:00',
  checkOutTime: '11:00',
  cancellationPolicy: 'moderate',
  requireDeposit: true,
  depositPercentage: 20,
  allowPets: true,
  petFee: 25,
  smokingAllowed: false,
  earlyCheckInFee: 30,
  lateCheckOutFee: 30,
  wifiIncluded: true,
  parkingIncluded: true,
  parkingFee: 0,
  currency: 'USD',
  timezone: 'America/New_York',
  businessHours: {
    open: '08:00',
    close: '22:00',
    daysOpen: ['monday'],
  },
  contactInfo: {
    email: 'contact@lodgeflow.com',
    phone: '+1234567890',
  },
  notifications: {
    emailEnabled: true,
    smsEnabled: false,
    bookingConfirmation: true,
    paymentReminders: true,
    checkInReminders: true,
  },
} satisfies SettingsJsonSource;

const mockSettingsDocument = {
  ...mockSettingsData,
  save: mockSave,
  toObject: () => ({ ...mockSettingsData }),
};

describe('/api/settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnectToDatabase.mockResolvedValue(mongoose);
  });

  describe('GET /api/settings', () => {
    it('should return settings when they exist', async () => {
      (mockSettings.findOne as jest.Mock).mockResolvedValue(
        mockSettingsDocument
      );

      const response = await GET();
      const data = await response.json();

      expect(mockConnectToDatabase).toHaveBeenCalledTimes(1);
      expect(mockSettings.findOne).toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toMatchObject({
        minBookingLength: 1,
        maxBookingLength: 30,
        breakfastPrice: 15,
      });
    });

    it('should create default settings when none exist', async () => {
      (mockSettings.findOne as jest.Mock).mockResolvedValue(null);
      (mockSettings.deleteMany as jest.Mock).mockResolvedValue({});
      (mockSettings.create as jest.Mock).mockResolvedValue(
        mockSettingsDocument
      );

      const response = await GET();
      const data = await response.json();

      expect(mockSettings.findOne).toHaveBeenCalled();
      expect(mockSettings.create).toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should handle database errors', async () => {
      (mockSettings.findOne as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });

  describe('PUT /api/settings', () => {
    it('should update settings successfully', async () => {
      const settingsWithSave = {
        ...mockSettingsDocument,
        save: mockSave.mockResolvedValue(mockSettingsDocument),
      };
      (mockSettings.findOne as jest.Mock).mockResolvedValue(settingsWithSave);

      const request = new NextRequest('http://localhost/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ breakfastPrice: 20 }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(mockConnectToDatabase).toHaveBeenCalledTimes(1);
      expect(mockSettings.findOne).toHaveBeenCalled();
      expect(mockSave).toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should reject invalid settings payload with structured errors', async () => {
      const settingsWithSave = {
        ...mockSettingsDocument,
        save: mockSave.mockResolvedValue(mockSettingsDocument),
      };
      (mockSettings.findOne as jest.Mock).mockResolvedValue(settingsWithSave);

      const request = new NextRequest('http://localhost/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ depositPercentage: 200 }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Validation failed');
      expect(data.details).toBeDefined();
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should create new settings if none exist on update', async () => {
      (mockSettings.findOne as jest.Mock).mockResolvedValue(null);
      (mockSettings.create as jest.Mock).mockResolvedValue(
        mockSettingsDocument
      );

      const request = new NextRequest('http://localhost/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ breakfastPrice: 20 }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(mockSettings.findOne).toHaveBeenCalled();
      expect(mockSettings.create).toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should handle update errors', async () => {
      const settingsWithSave = {
        ...mockSettingsDocument,
        save: jest.fn().mockRejectedValue(new Error('Update failed')),
      };
      (mockSettings.findOne as jest.Mock).mockResolvedValue(settingsWithSave);

      const request = new NextRequest('http://localhost/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ breakfastPrice: 20 }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });

    it('should handle invalid JSON', async () => {
      const request = new NextRequest('http://localhost/api/settings', {
        method: 'PUT',
        body: 'invalid json',
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ success: false, error: 'Invalid JSON body' });
    });
  });
});
