/** @jest-environment node */
import sitemap from '@/app/sitemap';
const mockConnect = jest.fn();
const mockCabins = jest.fn();
const mockExperiences = jest.fn();
const mockDining = jest.fn();
jest.mock('@lodgeflow/database', () => ({
  connectDB: () => mockConnect(),
  Cabin: {
    find: (...args: unknown[]) => {
      mockCabins(...args);
      return {
        select: () => ({
          lean: async () => [
            {
              _id: new (jest.requireActual<typeof import('mongoose')>(
                'mongoose'
              ).Types.ObjectId)('507f1f77bcf86cd799439011'),
              updatedAt: new Date('2040-01-01'),
            },
          ],
        }),
      };
    },
  },
  Experience: {
    find: (...args: unknown[]) => {
      mockExperiences(...args);
      return { select: () => ({ lean: async () => [] }) };
    },
  },
  Dining: {
    find: (...args: unknown[]) => {
      mockDining(...args);
      return {
        select: () => ({
          lean: async () => [
            {
              _id: new (jest.requireActual<typeof import('mongoose')>(
                'mongoose'
              ).Types.ObjectId)('507f1f77bcf86cd799439012'),
            },
          ],
        }),
      };
    },
  },
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockConnect.mockResolvedValue(undefined);
});
test('keeps static links, selected catalog visibility and date fallback', async () => {
  const entries = await sitemap();
  expect(entries).toHaveLength(8);
  expect(mockCabins).toHaveBeenCalledWith({ status: 'active' });
  expect(mockExperiences).toHaveBeenCalledWith({});
  expect(mockDining).toHaveBeenCalledWith({ isAvailable: true });
  expect(entries[6]).toEqual({
    url: 'https://lodgeflow.app/cabins/507f1f77bcf86cd799439011',
    lastModified: new Date('2040-01-01'),
    changeFrequency: 'weekly',
    priority: 0.8,
  });
  expect(entries[7]).toEqual({
    url: 'https://lodgeflow.app/dining/507f1f77bcf86cd799439012',
    lastModified: entries[0].lastModified,
    changeFrequency: 'weekly',
    priority: 0.7,
  });
});
test('retains static routes if the database is unavailable', async () => {
  mockConnect.mockRejectedValue(new Error('database unavailable'));
  const logged = jest.spyOn(console, 'error').mockImplementation(() => {});
  const entries = await sitemap();
  expect(entries).toHaveLength(6);
  expect(mockCabins).not.toHaveBeenCalled();
  logged.mockRestore();
});
