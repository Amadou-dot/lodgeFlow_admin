import { NextRequest } from 'next/server';

jest.mock('@/lib/mongodb', () => jest.fn().mockResolvedValue(undefined));

import { PUT } from '@/app/api/settings/route';
import Settings from '@/models/Settings';
import { settingsData } from '@/lib/data/seed-data';

function createRequest(body: unknown) {
  return new NextRequest(new URL('http://localhost:3000/api/settings'), {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

async function createDefaultSettings() {
  return Settings.create({
    ...settingsData,
    businessHours: {
      open: '09:00',
      close: '18:00',
      daysOpen: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    },
    notifications: {
      emailEnabled: true,
      smsEnabled: false,
      bookingConfirmation: true,
      paymentReminders: true,
      checkInReminders: true,
    },
  });
}

describe('Settings API Routes', () => {
  describe('PUT /api/settings', () => {
    it('updates settings with a valid partial payload', async () => {
      await createDefaultSettings();

      const response = await PUT(
        createRequest({ breakfastPrice: 22, depositPercentage: 30 })
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.breakfastPrice).toBe(22);
      expect(data.data.depositPercentage).toBe(30);
    });

    it('accepts payloads that include MongoDB metadata fields', async () => {
      const settings = await createDefaultSettings();

      const response = await PUT(
        createRequest({
          _id: settings._id.toString(),
          createdAt: settings.createdAt,
          updatedAt: settings.updatedAt,
          breakfastPrice: 18,
        })
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.breakfastPrice).toBe(18);
    });

    it('returns 400 with structured errors for out-of-range values', async () => {
      await createDefaultSettings();

      const response = await PUT(
        createRequest({ depositPercentage: 150 })
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Validation failed');
      expect(data.details).toBeDefined();
      expect(data.details.depositPercentage).toBeDefined();
    });

    it('returns 400 with structured errors for unknown keys', async () => {
      await createDefaultSettings();

      const response = await PUT(
        createRequest({ breakfastPrice: 20, taxRate: 5 })
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Validation failed');
      expect(data.details).toBeDefined();
    });

    it('returns 400 when minBookingLength exceeds existing maxBookingLength', async () => {
      await Settings.create({
        ...settingsData,
        minBookingLength: 2,
        maxBookingLength: 10,
        businessHours: {
          open: '09:00',
          close: '18:00',
          daysOpen: ['monday'],
        },
        notifications: {
          emailEnabled: true,
          smsEnabled: false,
          bookingConfirmation: true,
          paymentReminders: true,
          checkInReminders: true,
        },
      });

      const response = await PUT(createRequest({ minBookingLength: 15 }));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Validation failed');
      expect(data.details.maxBookingLength).toBeDefined();
    });

    it('returns 400 when both booking lengths are invalid in the payload', async () => {
      await createDefaultSettings();

      const response = await PUT(
        createRequest({ minBookingLength: 20, maxBookingLength: 10 })
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Validation failed');
      expect(data.details).toBeDefined();
    });
  });
});
