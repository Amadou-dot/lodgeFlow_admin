jest.mock('@/lib/seed-database', () => ({ seedDatabase: jest.fn() }));
import { seedDatabase } from '@/lib/seed-database';
import { GET } from '@/app/api/cron/seed/route';
const mockSeedDatabase = seedDatabase as jest.MockedFunction<
  typeof seedDatabase
>;
describe('GET /api/cron/seed authorization', () => {
  const originalSeedSecret = process.env.SEED_SECRET;
  const originalClerkSecret = process.env.CLERK_SECRET_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SEED_SECRET = 'seed-secret';
    process.env.CLERK_SECRET_KEY = 'clerk-secret';

    jest.spyOn(console, 'error').mockImplementation(() => {});

    mockSeedDatabase.mockResolvedValue({
      cabins: 1,
      dining: 14,
      experiences: 8,
      settings: 1,
      bookings: 0,
      clerkUsers: 0,
    });
  });

  afterEach(() => {
    if (originalSeedSecret === undefined) {
      delete process.env.SEED_SECRET;
    } else {
      process.env.SEED_SECRET = originalSeedSecret;
    }

    if (originalClerkSecret === undefined) {
      delete process.env.CLERK_SECRET_KEY;
    } else {
      process.env.CLERK_SECRET_KEY = originalClerkSecret;
    }

    jest.restoreAllMocks();
  });

  it('returns 500 when SEED_SECRET is not configured', async () => {
    delete process.env.SEED_SECRET;

    const response = await GET(new Request('http://localhost/api/cron/seed'));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      success: false,
      error: 'SEED_SECRET is not configured',
    });
    expect(mockSeedDatabase).not.toHaveBeenCalled();
  });

  it('returns 401 when the bearer token is invalid', async () => {
    const response = await GET(
      new Request('http://localhost/api/cron/seed', {
        headers: {
          Authorization: 'Bearer wrong-secret',
        },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBe('Bearer');
    expect(body).toEqual({
      success: false,
      error: 'Unauthorized',
    });
    expect(mockSeedDatabase).not.toHaveBeenCalled();
  });

  it('accepts a request with the configured bearer token', async () => {
    const response = await GET(
      new Request('http://localhost/api/cron/seed', {
        headers: {
          Authorization: 'Bearer seed-secret',
        },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      message: 'Database seeded successfully',
      results: {
        cabins: 1,
        experiences: 8,
        dining: 14,
        settings: 1,
        bookings: 0,
        clerkUsers: 0,
      },
    });
    expect(mockSeedDatabase).toHaveBeenCalledTimes(1);
  });
});
