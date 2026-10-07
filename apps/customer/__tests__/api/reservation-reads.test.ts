/** @jest-environment node */
import { NextRequest } from 'next/server';
import { logger } from '@lodgeflow/database/logger';
const mockAuth = jest.fn();
const mockConnect = jest.fn();
const mockFind = jest.fn(() => ({
  populate: () => ({ sort: () => ({ lean: async () => [] }) }),
}));
const mockFindById = jest.fn(() => ({ populate: async () => null }));
jest.mock('@clerk/nextjs/server', () => ({ auth: () => mockAuth() }));
jest.mock('@lodgeflow/database', () => ({
  connectDB: () => mockConnect(),
  DiningReservation: { find: () => mockFind(), findById: () => mockFindById() },
  ExperienceBooking: { find: () => mockFind(), findById: () => mockFindById() },
}));
import { GET as diningList } from '@/app/api/dining-reservations/route';
import { GET as diningHistory } from '@/app/api/dining-reservations/history/route';
import { GET as experienceList } from '@/app/api/experience-bookings/route';
import { GET as experienceHistory } from '@/app/api/experience-bookings/history/route';
import { GET as diningDetail } from '@/app/api/dining-reservations/[id]/route';
import { GET as experienceDetail } from '@/app/api/experience-bookings/[id]/route';
beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue({ userId: 'owner' });
  mockConnect.mockResolvedValue(undefined);
});
afterEach(() => jest.restoreAllMocks());
for (const route of [
  diningList,
  diningHistory,
  experienceList,
  experienceHistory,
]) {
  test('empty collection/history preserves its success envelope', async () => {
    const response = await route(
      new NextRequest('https://customer.test/api/reservations')
    );
    expect(await response.json()).toEqual({ success: true, data: [] });
  });
  test('invalid status fails before connecting or reading', async () => {
    const response = await route(
      new NextRequest('https://customer.test/api/reservations?status=bogus')
    );
    expect(response.status).toBe(400);
    expect(mockConnect).not.toHaveBeenCalled();
    expect(mockFind).not.toHaveBeenCalled();
  });
  test('denied collection/history reads cannot reach the database', async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });
    expect((await route(new NextRequest('https://customer.test'))).status).toBe(
      401
    );
    expect(mockConnect).not.toHaveBeenCalled();
    expect(mockFind).not.toHaveBeenCalled();
  });
  test('unexpected read failures are safely logged', async () => {
    const failure = new Error('private database detail');
    const log = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockConnect.mockRejectedValueOnce(failure);
    const response = await route(new NextRequest('https://customer.test'));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('private');
    expect(log).toHaveBeenCalledWith(expect.any(String), failure);
  });
}
for (const route of [diningDetail, experienceDetail]) {
  test('invalid detail IDs fail without a database read', async () => {
    const response = await route(new NextRequest('https://customer.test'), {
      params: Promise.resolve({ id: 'invalid' }),
    });
    expect(response.status).toBe(404);
    expect(mockConnect).not.toHaveBeenCalled();
    expect(mockFindById).not.toHaveBeenCalled();
  });
}
