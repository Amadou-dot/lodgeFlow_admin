import { NextRequest } from 'next/server';
import { Settings } from '@lodgeflow/database';
import { GET, PUT, POST } from '@/app/api/settings/route';
import { createErrorResponse, requireApiAuth } from '@/lib/api-utils';
import connectDB from '@/lib/mongodb';
import { logger } from '@/lib/logger';

jest.mock('@/lib/mongodb', () => jest.fn().mockResolvedValue(undefined));

function json(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(requireApiAuth).mockResolvedValue({
    authenticated: true,
    userId: 'user_staff',
    role: 'admin',
  });
});
afterEach(() => jest.restoreAllMocks());

test.each([
  'invalid json',
  '[]',
  'null',
  '{"$set":{"breakfastPrice":0}}',
  '{"contactInfo.email":"injected@example.invalid"}',
  '{"singleton":"other"}',
])('invalid payload %s is rejected before database access', async body => {
  await Settings.create({ breakfastPrice: 15 });
  const before = json(await Settings.findOne().lean());
  const response = await PUT(
    new NextRequest('https://admin.test/api/settings', { method: 'PUT', body })
  );
  expect(response.status).toBe(400);
  expect(connectDB).not.toHaveBeenCalled();
  expect(json(await Settings.findOne().lean())).toEqual(before);
});

test('unexpected read failures are safely logged', async () => {
  const failure = new Error('private database failure');
  jest.spyOn(Settings, 'findOne').mockRejectedValueOnce(failure);
  const log = jest.spyOn(logger, 'error').mockImplementation(() => {});
  const response = await GET();
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({
    success: false,
    error: 'Failed to fetch settings',
  });
  expect(log).toHaveBeenCalledWith('Failed to fetch settings', failure);
});

test.each([
  {
    phone: '18005551234',
    address: { street: '1 Pine Road', city: 'Forest', country: 'USA' },
  },
  {},
  null,
])(
  'GET preserves complete Settings JSON and nested omissions: %p',
  async contactInfo => {
    const settings = await Settings.create({ contactInfo });
    const before = json(await Settings.findById(settings._id).lean());
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: json(settings),
    });
    expect(json(await Settings.findById(settings._id).lean())).toEqual(before);
  }
);

test('first read creates defaults and returns their full JSON', async () => {
  const response = await GET();
  expect(response.status).toBe(200);
  const stored = await Settings.findOne().orFail();
  expect(await response.json()).toEqual({ success: true, data: json(stored) });
  expect(stored.fullAddress).toContain('Pine Valley');
  expect(await Settings.countDocuments()).toBe(1);
});

test('partial update preserves nested replacement semantics and full response fields', async () => {
  await Settings.create({
    contactInfo: { phone: '18005551234', address: { city: 'Forest' } },
  });
  const response = await PUT(
    new NextRequest('https://admin.test/api/settings', {
      method: 'PUT',
      body: JSON.stringify({
        contactInfo: { email: 'new@example.invalid' },
        breakfastPrice: 23,
      }),
    })
  );
  expect(response.status).toBe(200);
  const stored = await Settings.findOne().orFail();
  expect(await response.json()).toEqual({ success: true, data: json(stored) });
  expect(stored.contactInfo.phone).toBeUndefined();
  expect(stored.contactInfo.email).toBe('new@example.invalid');
  expect(stored.breakfastPrice).toBe(23);
});

test('reset returns the newly created defaults with virtuals and timestamps', async () => {
  const old = await Settings.create({ breakfastPrice: 99 });
  const response = await POST();
  expect(response.status).toBe(200);
  const stored = await Settings.findOne().orFail();
  expect(String(stored._id)).not.toBe(String(old._id));
  expect(await response.json()).toEqual({ success: true, data: json(stored) });
  expect(await Settings.countDocuments()).toBe(1);
});

test.each(['GET', 'PUT', 'POST'])(
  '%s denies before reading or writing Settings',
  async method => {
    const error = createErrorResponse('Denied', 403);
    jest
      .mocked(requireApiAuth)
      .mockResolvedValue({ authenticated: false, error });
    const response =
      method === 'GET'
        ? await GET()
        : method === 'POST'
          ? await POST()
          : await PUT(
              new NextRequest('https://admin.test/api/settings', {
                method: 'PUT',
                body: '{}',
              })
            );
    expect(response).toBe(error);
    expect(connectDB).not.toHaveBeenCalled();
    expect(await Settings.countDocuments()).toBe(0);
  }
);
