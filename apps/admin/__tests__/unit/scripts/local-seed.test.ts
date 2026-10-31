const mockSeedDatabase = jest.fn().mockResolvedValue({});
const mockLoadEnvironment = jest.fn();
const mockDisconnect = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/seed-database', () => ({
  seedDatabase: mockSeedDatabase,
}));
jest.mock('dotenv', () => ({ config: mockLoadEnvironment }));
jest.mock('mongoose', () => ({
  __esModule: true,
  default: { disconnect: mockDisconnect },
}));

test('local seed exits without loading credentials or invoking database seeding', async () => {
  const notice = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    await import('@/scripts/seed');

    expect(mockLoadEnvironment).not.toHaveBeenCalled();
    expect(mockSeedDatabase).not.toHaveBeenCalled();
    expect(mockDisconnect).not.toHaveBeenCalled();
    expect(notice).toHaveBeenCalledWith(
      expect.stringContaining('separate testing database')
    );
  } finally {
    notice.mockRestore();
  }
});
