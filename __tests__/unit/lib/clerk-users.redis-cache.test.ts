/* eslint-disable @typescript-eslint/no-explicit-any */

// Mocks are hoisted above the imports, so the factories below reference the
// `mock*` bindings lazily (inside arrow functions) to avoid a TDZ error.
const mockGetUser = jest.fn();

jest.mock('@clerk/nextjs/server', () => ({
  clerkClient: jest.fn().mockResolvedValue({
    users: {
      getUser: (...args: any[]) => mockGetUser(...args),
      getUserList: jest.fn(),
      updateUser: jest.fn(),
      updateUserMetadata: jest.fn(),
      deleteUser: jest.fn(),
    },
  }),
  User: {},
}));

const mockRedisGet = jest.fn();
const mockRedisSet = jest.fn();
const mockRedisMget = jest.fn();
const mockRedisDel = jest.fn();

jest.mock('@upstash/redis', () => ({
  Redis: jest.fn().mockImplementation(() => ({
    get: (...args: any[]) => mockRedisGet(...args),
    set: (...args: any[]) => mockRedisSet(...args),
    mget: (...args: any[]) => mockRedisMget(...args),
    del: (...args: any[]) => mockRedisDel(...args),
  })),
}));

import {
  getClerkUser,
  getClerkUsersBatch,
  resetUserCache,
} from '@/lib/clerk-users';
import { resetRedisClient } from '@/lib/redis';

const CACHE_DURATION_MS = 5 * 60 * 1000;

function enableRedis(): void {
  process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
  resetRedisClient();
}

function disableRedis(): void {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  resetRedisClient();
}

let uniqueCounter = 0;
function uid(prefix = 'user'): string {
  uniqueCounter++;
  return `${prefix}_${Date.now()}_${uniqueCounter}`;
}

function clerkUser(id: string, overrides: Record<string, any> = {}) {
  return {
    id,
    firstName: 'Test',
    lastName: 'User',
    username: null,
    emailAddresses: [{ id: 'email_1', emailAddress: `${id}@example.com` }],
    primaryEmailAddressId: 'email_1',
    phoneNumbers: [],
    imageUrl: '',
    hasImage: false,
    publicMetadata: {},
    privateMetadata: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastSignInAt: null,
    lastActiveAt: Date.now(),
    banned: false,
    locked: false,
    ...overrides,
  };
}

/** A cache entry as it comes back from Redis: JSON, so Dates are ISO strings. */
function redisEntry(id: string, overrides: Record<string, any> = {}) {
  return {
    data: {
      id,
      username: null,
      first_name: 'Cached',
      last_name: 'User',
      name: 'Cached User',
      email: `${id}@example.com`,
      image_url: '',
      has_image: false,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z',
      last_sign_in_at: null,
      last_active_at: '2026-01-03T00:00:00.000Z',
      banned: false,
      locked: false,
      lockout_expires_in_seconds: null,
      totalBookings: 0,
      totalSpent: 0,
      loyaltyTier: 'Bronze',
      fullAddress: '',
      ...overrides,
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  resetUserCache();
  enableRedis();
  mockRedisSet.mockResolvedValue('OK');
  mockRedisDel.mockResolvedValue(1);
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  disableRedis();
  jest.restoreAllMocks();
});

describe('getClerkUser — Redis-backed cache', () => {
  it('serves a hit from Redis without calling Clerk', async () => {
    const id = uid();
    mockRedisGet.mockResolvedValue(redisEntry(id));

    const customer = await getClerkUser(id);

    expect(mockRedisGet).toHaveBeenCalledWith(`lodgeflow:clerk-user:${id}`);
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(customer?.id).toBe(id);
    expect(customer?.name).toBe('Cached User');
  });

  it('revives Date fields that JSON serialization flattened to strings', async () => {
    const id = uid();
    mockRedisGet.mockResolvedValue(
      redisEntry(id, { last_sign_in_at: '2026-01-04T00:00:00.000Z' })
    );

    const customer = await getClerkUser(id);

    expect(customer!.created_at).toBeInstanceOf(Date);
    expect(customer!.updated_at).toBeInstanceOf(Date);
    expect(customer!.last_active_at).toBeInstanceOf(Date);
    expect(customer!.last_sign_in_at).toBeInstanceOf(Date);
    expect(customer!.created_at.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('keeps a null last_sign_in_at as null rather than an Invalid Date', async () => {
    const id = uid();
    mockRedisGet.mockResolvedValue(redisEntry(id));

    const customer = await getClerkUser(id);

    expect(customer!.last_sign_in_at).toBeNull();
  });

  it('writes through to Redis with the 5-minute TTL on a miss', async () => {
    const id = uid();
    mockRedisGet.mockResolvedValue(null);
    mockGetUser.mockResolvedValue(clerkUser(id));

    await getClerkUser(id);

    expect(mockGetUser).toHaveBeenCalledWith(id);
    expect(mockRedisSet).toHaveBeenCalledWith(
      `lodgeflow:clerk-user:${id}`,
      expect.objectContaining({ data: expect.objectContaining({ id }) }),
      { px: CACHE_DURATION_MS }
    );
  });

  it('distinguishes a cached "user does not exist" from a cache miss', async () => {
    const id = uid();
    // The wrapper object is present but its payload is null.
    mockRedisGet.mockResolvedValue({ data: null });

    await expect(getClerkUser(id)).resolves.toBeNull();
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('caches a 404 as a null payload so the lookup is not retried', async () => {
    const id = uid();
    mockRedisGet.mockResolvedValue(null);
    mockGetUser.mockRejectedValue({ status: 404 });

    await expect(getClerkUser(id)).resolves.toBeNull();

    expect(mockRedisSet).toHaveBeenCalledWith(
      `lodgeflow:clerk-user:${id}`,
      { data: null },
      { px: CACHE_DURATION_MS }
    );
  });

  it('does not cache transient Clerk errors', async () => {
    const id = uid();
    mockRedisGet.mockResolvedValue(null);
    mockGetUser.mockRejectedValue({ status: 500 });

    await expect(getClerkUser(id)).rejects.toEqual({ status: 500 });
    expect(mockRedisSet).not.toHaveBeenCalled();
  });

  it('treats a Redis read failure as a miss and still returns the user', async () => {
    const id = uid();
    mockRedisGet.mockRejectedValue(new Error('ECONNREFUSED'));
    mockGetUser.mockResolvedValue(clerkUser(id));

    const customer = await getClerkUser(id);

    expect(customer?.id).toBe(id);
    expect(mockGetUser).toHaveBeenCalledWith(id);
  });

  it('does not fail the request when the Redis write fails', async () => {
    const id = uid();
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockRejectedValue(new Error('quota exceeded'));
    mockGetUser.mockResolvedValue(clerkUser(id));

    await expect(getClerkUser(id)).resolves.toMatchObject({ id });
  });
});

describe('getClerkUsersBatch — Redis-backed cache', () => {
  it('reads every id in a single mget round trip', async () => {
    const ids = [uid(), uid(), uid()];
    mockRedisMget.mockResolvedValue(ids.map(id => redisEntry(id)));

    const { users, errors } = await getClerkUsersBatch(ids);

    expect(mockRedisMget).toHaveBeenCalledTimes(1);
    expect(mockRedisMget).toHaveBeenCalledWith(
      ...ids.map(id => `lodgeflow:clerk-user:${id}`)
    );
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(users.size).toBe(3);
    expect(errors).toBe(0);
  });

  it('fetches only the ids that missed the cache', async () => {
    const cachedId = uid('cached');
    const freshId = uid('fresh');
    mockRedisMget.mockResolvedValue([redisEntry(cachedId), null]);
    mockGetUser.mockResolvedValue(clerkUser(freshId));

    const { users } = await getClerkUsersBatch([cachedId, freshId]);

    expect(mockGetUser).toHaveBeenCalledTimes(1);
    expect(mockGetUser).toHaveBeenCalledWith(freshId);
    expect(users.get(cachedId)?.name).toBe('Cached User');
    expect(users.get(freshId)?.id).toBe(freshId);
  });

  it('honors a cached null payload as "user does not exist"', async () => {
    const goneId = uid('gone');
    mockRedisMget.mockResolvedValue([{ data: null }]);

    const { users, errors } = await getClerkUsersBatch([goneId]);

    expect(users.get(goneId)).toBeNull();
    expect(users.has(goneId)).toBe(true);
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(errors).toBe(0);
  });

  it('falls back to fetching everything when mget fails', async () => {
    const id = uid();
    mockRedisMget.mockRejectedValue(new Error('ECONNREFUSED'));
    mockGetUser.mockResolvedValue(clerkUser(id));

    const { users, errors } = await getClerkUsersBatch([id]);

    expect(users.get(id)?.id).toBe(id);
    expect(errors).toBe(0);
  });
});

describe('in-memory fallback when Upstash is not configured', () => {
  beforeEach(() => {
    disableRedis();
    resetUserCache();
  });

  it('caches within the process and never touches Redis', async () => {
    const id = uid();
    mockGetUser.mockResolvedValue(clerkUser(id));

    await getClerkUser(id);
    await getClerkUser(id);

    expect(mockGetUser).toHaveBeenCalledTimes(1);
    expect(mockRedisGet).not.toHaveBeenCalled();
    expect(mockRedisSet).not.toHaveBeenCalled();
  });

  it('serves the batch path from the in-memory cache', async () => {
    const id = uid();
    mockGetUser.mockResolvedValue(clerkUser(id));

    await getClerkUser(id); // populate
    const { users } = await getClerkUsersBatch([id]);

    expect(mockGetUser).toHaveBeenCalledTimes(1);
    expect(mockRedisMget).not.toHaveBeenCalled();
    expect(users.get(id)?.id).toBe(id);
  });
});
