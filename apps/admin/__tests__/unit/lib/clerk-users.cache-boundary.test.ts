import type { z } from 'zod';
import type { customerCacheEntrySchema } from '@/lib/validations/customer-cache';
import {
  getClerkUser,
  getClerkUsersBatch,
  resetUserCache,
} from '@/lib/clerk-users';
import { logger } from '@/lib/logger';

// These fixtures model only the fields read from the mocked SDK dependency.
function clerkUser(id: string) {
  return {
    id,
    firstName: 'Fresh',
    lastName: 'Guest',
    username: null,
    emailAddresses: [{ id: 'email_1', emailAddress: `${id}@example.com` }],
    primaryEmailAddressId: 'email_1',
    phoneNumbers: [],
    imageUrl: '',
    hasImage: false,
    publicMetadata: {},
    privateMetadata: {},
    createdAt: Date.parse('2026-01-01T00:00:00.000Z'),
    updatedAt: Date.parse('2026-01-02T00:00:00.000Z'),
    lastSignInAt: null,
    lastActiveAt: Date.parse('2026-01-03T00:00:00.000Z'),
    banned: false,
    locked: false,
  };
}

const mockGetUser = jest.fn<Promise<ReturnType<typeof clerkUser>>, [string]>();
const mockGet = jest.fn<Promise<unknown>, [string]>();
const mockMget = jest.fn<Promise<unknown[]>, string[]>();
const mockSet = jest.fn<Promise<string>, [string, unknown, { px: number }]>();
const mockRedis = { get: mockGet, mget: mockMget, set: mockSet };
jest.mock('@clerk/nextjs/server', () => ({
  clerkClient: async () => ({ users: { getUser: mockGetUser } }),
}));
jest.mock('@/lib/redis', () => ({
  REDIS_KEY_PREFIX: 'lodgeflow',
  getRedisClient: () => mockRedis,
}));
jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn() },
}));

type CachedCustomer = NonNullable<
  z.input<typeof customerCacheEntrySchema>['data']
>;

function cachedCustomer(id: string): CachedCustomer {
  return {
    id,
    username: null,
    first_name: 'Cached',
    last_name: 'Guest',
    name: 'Cached Guest',
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
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  resetUserCache();
  mockGet.mockResolvedValue(null);
  mockMget.mockImplementation(async (...ids) => ids.map(() => null));
  mockSet.mockResolvedValue('OK');
  mockGetUser.mockImplementation(async id => clerkUser(id));
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('customer cache characterization', () => {
  test('retains complete customer JSON and revives all five timestamp fields', async () => {
    const data: CachedCustomer = {
      ...cachedCustomer('user_full'),
      username: 'guest',
      phone: '+15555550100',
      last_sign_in_at: '2026-01-04T00:00:00.000Z',
      lastBookingDate: '2026-01-05T00:00:00.000Z',
      nationality: 'US',
      nationalId: 'EXAMPLE123',
      address: {
        street: '123 Example St',
        city: 'Denver',
        state: 'CO',
        country: 'US',
        zipCode: '80201',
      },
      emergencyContact: {
        firstName: 'Example',
        lastName: 'Contact',
        phone: '+15555550101',
        relationship: 'friend',
      },
      preferences: {
        smokingPreference: 'non-smoking',
        dietaryRestrictions: ['vegan'],
        accessibilityNeeds: ['step-free'],
      },
      totalBookings: 2,
      totalSpent: 210.5,
      loyaltyTier: 'Silver',
      fullAddress: '123 Example St, Denver, CO, US, 80201',
    };
    mockGet.mockResolvedValue({ data });
    const customer = await getClerkUser(data.id);
    const json: unknown = JSON.parse(JSON.stringify(customer));
    expect(json).toEqual(data);
    expect(customer).toMatchObject({
      created_at: new Date(data.created_at),
      updated_at: new Date(data.updated_at),
      last_sign_in_at: new Date('2026-01-04T00:00:00.000Z'),
      last_active_at: new Date(data.last_active_at),
      lastBookingDate: new Date('2026-01-05T00:00:00.000Z'),
    });
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
  });

  test('preserves nullable profile fields and absent optional metadata', async () => {
    const data = {
      ...cachedCustomer('user_sparse'),
      first_name: null,
      last_name: null,
    };
    mockGet.mockResolvedValue({ data });
    const customer = await getClerkUser(data.id);
    const json: unknown = JSON.parse(JSON.stringify(customer));
    expect(json).toEqual(data);
    expect(customer?.last_sign_in_at).toBeNull();
    expect(customer?.lastBookingDate).toBeUndefined();
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  test('only fetches misses in a mixed batch with a cached deleted user', async () => {
    mockMget.mockResolvedValue([
      { data: cachedCustomer('user_hit') },
      { data: null },
      null,
    ]);
    const { users, errors } = await getClerkUsersBatch([
      'user_hit',
      'user_deleted',
      'user_miss',
    ]);
    expect(Array.from(users.keys())).toEqual([
      'user_hit',
      'user_deleted',
      'user_miss',
    ]);
    expect(users.get('user_hit')?.name).toBe('Cached Guest');
    expect(users.get('user_deleted')).toBeNull();
    expect(users.get('user_miss')?.name).toBe('Fresh Guest');
    expect(errors).toBe(0);
    expect(mockGetUser).toHaveBeenCalledTimes(1);
    expect(mockGetUser).toHaveBeenCalledWith('user_miss');
  });

  test('writes the existing JSON envelope, timestamp representation and TTL', async () => {
    const customer = await getClerkUser('user_write');
    expect(mockSet).toHaveBeenCalledTimes(1);
    const [key, payload, options] = mockSet.mock.calls[0];
    expect(key).toBe('lodgeflow:clerk-user:user_write');
    expect(options).toEqual({ px: 300000 });
    expect(JSON.stringify(payload)).toBe(JSON.stringify({ data: customer }));
  });

  test('propagates a single transient failure and retries without caching a deleted user', async () => {
    const failure = new Error('Clerk unavailable');
    mockGetUser.mockRejectedValueOnce(failure);
    await expect(getClerkUser('user_retry')).rejects.toBe(failure);
    expect(mockSet).not.toHaveBeenCalled();
    await expect(getClerkUser('user_retry')).resolves.toMatchObject({
      id: 'user_retry',
    });
    expect(mockGetUser).toHaveBeenCalledTimes(2);
  });

  test('counts batch transient errors while preserving deleted-user caching', async () => {
    mockGetUser
      .mockRejectedValueOnce({ status: 404 })
      .mockRejectedValueOnce({ status: 500 });
    const result = await getClerkUsersBatch(['user_gone', 'user_flaky']);
    expect(result.errors).toBe(1);
    expect(Array.from(result.users.values())).toEqual([null, null]);
    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith(
      'lodgeflow:clerk-user:user_gone',
      { data: null },
      { px: 300000 }
    );
  });
});

const malformedEntries: { name: string; entry: unknown }[] = [
  { name: 'missing data', entry: {} },
  { name: 'false data', entry: { data: false } },
  { name: 'numeric data', entry: { data: 0 } },
  { name: 'empty text data', entry: { data: '' } },
  { name: 'array data', entry: { data: [] } },
  {
    name: 'other user identity',
    entry: { data: cachedCustomer('user_other') },
  },
  {
    name: 'missing name',
    entry: { data: { ...cachedCustomer('user_bad'), name: undefined } },
  },
  {
    name: 'null required timestamp',
    entry: { data: { ...cachedCustomer('user_bad'), created_at: null } },
  },
  {
    name: 'invalid timestamp',
    entry: { data: { ...cachedCustomer('user_bad'), updated_at: 'invalid' } },
  },
  {
    name: 'numeric timestamp',
    entry: {
      data: { ...cachedCustomer('user_bad'), last_active_at: 1700000000000 },
    },
  },
  {
    name: 'object timestamp',
    entry: { data: { ...cachedCustomer('user_bad'), created_at: {} } },
  },
  {
    name: 'invalid optional timestamp',
    entry: {
      data: { ...cachedCustomer('user_bad'), lastBookingDate: 'yesterday' },
    },
  },
  {
    name: 'invalid nullable timestamp',
    entry: { data: { ...cachedCustomer('user_bad'), last_sign_in_at: false } },
  },
  {
    name: 'invalid metadata',
    entry: { data: { ...cachedCustomer('user_bad'), address: { city: 42 } } },
  },
  {
    name: 'invalid preference',
    entry: {
      data: {
        ...cachedCustomer('user_bad'),
        preferences: { smokingPreference: 'invalid' },
      },
    },
  },
  {
    name: 'invalid numeric field',
    entry: { data: { ...cachedCustomer('user_bad'), totalSpent: '210.50' } },
  },
];

describe('invalid customer cache regressions', () => {
  test('returns only known customer fields from a valid cache entry', async () => {
    mockGet.mockResolvedValue({
      data: {
        ...cachedCustomer('user_extra'),
        privateNote: 'untrusted extra value',
        address: { city: 'Denver', privateNote: 'untrusted nested value' },
        recentBookings: [
          {
            _id: 'booking_1',
            cabin: { name: 'Cabin', image: '/cabin.jpg' },
            checkInDate: '2026-03-01T00:00:00.000Z',
            checkOutDate: '2026-03-03T00:00:00.000Z',
            numNights: 2,
            status: 'confirmed',
            totalPrice: 200,
          },
        ],
      },
    });
    const customer = await getClerkUser('user_extra');
    expect(customer).not.toHaveProperty('privateNote');
    expect(customer?.address).toEqual({ city: 'Denver' });
    expect(customer?.recentBookings).toEqual([
      {
        _id: 'booking_1',
        cabin: { name: 'Cabin', image: '/cabin.jpg' },
        checkInDate: '2026-03-01T00:00:00.000Z',
        checkOutDate: '2026-03-03T00:00:00.000Z',
        numNights: 2,
        status: 'confirmed',
        totalPrice: 200,
      },
    ]);
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  test.each(malformedEntries)(
    'refetches $name instead of trusting it or treating it as a deleted user',
    async ({ entry }) => {
      mockGet.mockResolvedValue(entry);
      await expect(getClerkUser('user_bad')).resolves.toMatchObject({
        id: 'user_bad',
        name: 'Fresh Guest',
      });
      expect(mockGetUser).toHaveBeenCalledTimes(1);
      expect(mockSet).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        'Invalid customer cache entry, treating as miss',
        { userId: 'user_bad' }
      );
    }
  );

  test('retains good hits on either side of a malformed batch entry', async () => {
    mockMget.mockResolvedValue([
      { data: cachedCustomer('user_first') },
      { data: { ...cachedCustomer('user_bad'), created_at: null } },
      { data: cachedCustomer('user_last') },
      { data: null },
    ]);
    const { users, errors } = await getClerkUsersBatch([
      'user_first',
      'user_bad',
      'user_last',
      'user_deleted',
    ]);
    expect(users.get('user_first')?.name).toBe('Cached Guest');
    expect(users.get('user_last')?.name).toBe('Cached Guest');
    expect(users.get('user_bad')?.name).toBe('Fresh Guest');
    expect(users.get('user_deleted')).toBeNull();
    expect(errors).toBe(0);
    expect(mockGetUser).toHaveBeenCalledTimes(1);
    expect(mockGetUser).toHaveBeenCalledWith('user_bad');
  });

  test('retries invalid entries after transient failures instead of caching null', async () => {
    mockMget.mockResolvedValue([{ data: false }]);
    mockGetUser.mockRejectedValueOnce({ status: 500 });
    const first = await getClerkUsersBatch(['user_retry']);
    expect(first.errors).toBe(1);
    expect(first.users.get('user_retry')).toBeNull();
    expect(mockSet).not.toHaveBeenCalled();
    const next = await getClerkUsersBatch(['user_retry']);
    expect(next.errors).toBe(0);
    expect(next.users.get('user_retry')?.name).toBe('Fresh Guest');
    expect(mockGetUser).toHaveBeenCalledTimes(2);
  });
});
