/** @jest-environment node */
import { NextRequest } from 'next/server';
import { logger } from '@lodgeflow/database/logger';
const mockConnect = jest.fn();
const mockFind = jest.fn(() => ({ lean: async () => null }));
jest.mock('@lodgeflow/database', () => ({
  connectDB: () => mockConnect(),
  Dining: { findById: () => mockFind() },
  Experience: { findById: () => mockFind() },
}));
import { GET as dining } from '@/app/api/dining/[id]/route';
import { GET as experience } from '@/app/api/experiences/[id]/route';
beforeEach(() => {
  jest.clearAllMocks();
  mockConnect.mockResolvedValue(undefined);
});
afterEach(() => jest.restoreAllMocks());
for (const route of [dining, experience]) {
  test('missing catalogs retain their 404 envelope', async () => {
    const response = await route(new NextRequest('https://customer.test'), {
      params: Promise.resolve({ id: '507f1f77bcf86cd799439011' }),
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      success: false,
      error:
        route === dining ? 'Dining item not found' : 'Experience not found',
    });
  });
  test('invalid catalog IDs fail before connection', async () => {
    const response = await route(new NextRequest('https://customer.test'), {
      params: Promise.resolve({ id: 'invalid' }),
    });
    expect(response.status).toBe(404);
    expect(mockConnect).not.toHaveBeenCalled();
    expect(mockFind).not.toHaveBeenCalled();
  });
  test('unexpected database failures are safely logged', async () => {
    const failure = new Error('private database detail');
    const log = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockConnect.mockRejectedValueOnce(failure);
    const response = await route(new NextRequest('https://customer.test'), {
      params: Promise.resolve({ id: '507f1f77bcf86cd799439011' }),
    });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Internal server error',
    });
    expect(log).toHaveBeenCalledWith(expect.any(String), failure);
  });
}
