jest.mock('@/lib/mongodb', () => jest.fn().mockResolvedValue(undefined));

jest.mock('@clerk/backend', () => ({
  createClerkClient: jest.fn(),
}));

jest.mock('@faker-js/faker', () => ({
  faker: {},
}));

jest.mock('@/models', () => ({
  Cabin: {
    deleteMany: jest.fn().mockResolvedValue({ acknowledged: true }),
    insertMany: jest.fn().mockResolvedValue([{ _id: 'cabin_1' }]),
  },
  Booking: {
    deleteMany: jest.fn().mockResolvedValue({ acknowledged: true }),
    create: jest.fn(),
  },
  Settings: {
    deleteMany: jest.fn().mockResolvedValue({ acknowledged: true }),
    create: jest.fn().mockResolvedValue({}),
  },
  Experience: {
    deleteMany: jest.fn().mockResolvedValue({ acknowledged: true }),
    insertMany: jest.fn().mockResolvedValue([]),
  },
  Dining: {
    deleteMany: jest.fn().mockResolvedValue({ acknowledged: true }),
    insertMany: jest.fn().mockResolvedValue([]),
  },
}));

import { createClerkClient } from '@clerk/backend';

import { diningData, experienceData } from '@/lib/data/seed-data';
import connectDB from '@/lib/mongodb';
import { GET } from '@/app/api/cron/seed/route';

const mockConnectDB = connectDB as jest.MockedFunction<typeof connectDB>;
const mockCreateClerkClient = createClerkClient as jest.MockedFunction<
  typeof createClerkClient
>;

describe('GET /api/cron/seed authorization', () => {
  const originalSeedSecret = process.env.SEED_SECRET;
  const originalClerkSecret = process.env.CLERK_SECRET_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SEED_SECRET = 'seed-secret';
    process.env.CLERK_SECRET_KEY = 'clerk-secret';

    jest.spyOn(console, 'error').mockImplementation(() => {});

    mockCreateClerkClient.mockReturnValue({
      users: {
        getUserList: jest.fn().mockResolvedValue({ data: [] }),
      },
    } as Awaited<ReturnType<typeof createClerkClient>>);
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
    expect(mockConnectDB).not.toHaveBeenCalled();
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
    expect(mockConnectDB).not.toHaveBeenCalled();
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
      message: 'Database seeded (no Clerk users found, skipped booking creation)',
      results: {
        cabins: 1,
        experiences: experienceData.length,
        dining: diningData.length,
        settings: 1,
        bookings: 0,
      },
    });
    expect(mockConnectDB).toHaveBeenCalledTimes(1);
    expect(mockCreateClerkClient).toHaveBeenCalledWith({
      secretKey: 'clerk-secret',
    });
  });
});
