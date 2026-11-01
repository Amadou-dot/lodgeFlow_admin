import {
  getClerkUser,
  getClerkUsersBatch,
  lockClerkUser,
  unlockClerkUser,
  resetUserCache,
  type CustomerClerkSource,
} from '@/lib/clerk-users';
import { CustomerProviderError } from '@/lib/customer-errors';
import { logger } from '@/lib/logger';

const profiles = new Map<string, CustomerClerkSource>();
const entries = new Map<string, unknown>();
let mockUseRedis = false;
const mockGetUser = jest.fn<Promise<CustomerClerkSource>, [string]>();
const mockLock = jest.fn<Promise<CustomerClerkSource>, [string]>();
const mockUnlock = jest.fn<Promise<CustomerClerkSource>, [string]>();
const mockDelete = jest.fn<Promise<number>, [string]>();
const mockRedis = {
  get: async (key: string) => entries.get(key) ?? null,
  mget: async (...keys: string[]) => keys.map(key => entries.get(key) ?? null),
  set: async (key: string, value: unknown) => {
    const json: unknown = JSON.parse(JSON.stringify(value));
    entries.set(key, json);
    return 'OK';
  },
  del: mockDelete,
};
jest.mock('@clerk/nextjs/server', () => ({
  clerkClient: async () => ({
    users: { getUser: mockGetUser, lockUser: mockLock, unlockUser: mockUnlock },
  }),
}));
jest.mock('@/lib/redis', () => ({
  REDIS_KEY_PREFIX: 'lodgeflow',
  getRedisClient: () => (mockUseRedis ? mockRedis : null),
}));
jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn() },
}));

function profile(id: string): CustomerClerkSource {
  return {
    id,
    firstName: 'Guest',
    lastName: null,
    username: null,
    primaryEmailAddressId: null,
    emailAddresses: [],
    phoneNumbers: [],
    imageUrl: '',
    hasImage: false,
    publicMetadata: {},
    privateMetadata: {},
    createdAt: Date.parse('2030-01-01T00:00:00.000Z'),
    updatedAt: Date.parse('2030-01-01T00:00:00.000Z'),
    lastSignInAt: null,
    lastActiveAt: null,
    banned: false,
    locked: false,
  };
}

function currentProfile(id: string): CustomerClerkSource {
  const value = profiles.get(id);
  if (!value) throw new Error('Unknown fixture identity');
  return value;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockReset();
  mockLock.mockReset();
  mockUnlock.mockReset();
  mockDelete.mockReset();
  resetUserCache();
  entries.clear();
  profiles.clear();
  for (const id of ['user_guest', 'user_other']) profiles.set(id, profile(id));
  mockGetUser.mockImplementation(async id => ({ ...currentProfile(id) }));
  mockLock.mockImplementation(async id => {
    const value = { ...currentProfile(id), locked: true };
    profiles.set(id, value);
    return value;
  });
  mockUnlock.mockImplementation(async id => {
    const value = { ...currentProfile(id), locked: false };
    profiles.set(id, value);
    return value;
  });
  mockDelete.mockImplementation(async key => Number(entries.delete(key)));
});

describe.each(['memory', 'redis'])('%s customer lock cache', backend => {
  beforeEach(() => {
    mockUseRedis = backend === 'redis';
  });

  describe.each([
    { action: 'lock', execute: lockClerkUser, initial: false, expected: true },
    {
      action: 'unlock',
      execute: unlockClerkUser,
      initial: true,
      expected: false,
    },
  ])('$action success', ({ execute, initial, expected }) => {
    test.each(['single', 'batch'])(
      'refreshes %s reads without evicting another customer',
      async read => {
        profiles.set('user_guest', {
          ...profile('user_guest'),
          locked: initial,
        });
        await getClerkUser('user_guest');
        await getClerkUser('user_other');
        expect(mockGetUser).toHaveBeenCalledTimes(2);
        const result = await execute('user_guest');
        expect(result).toBe(currentProfile('user_guest'));
        const guest =
          read === 'single'
            ? await getClerkUser('user_guest')
            : (
                await getClerkUsersBatch(['user_other', 'user_guest'])
              ).users.get('user_guest');
        expect(guest?.locked).toBe(expected);
        expect((await getClerkUser('user_other'))?.locked).toBe(false);
        expect(mockGetUser.mock.calls.map(([id]) => id)).toEqual([
          'user_guest',
          'user_other',
          'user_guest',
        ]);
      }
    );
  });

  test.each([
    {
      action: 'lock',
      execute: lockClerkUser,
      provider: mockLock,
      initial: false,
    },
    {
      action: 'unlock',
      execute: unlockClerkUser,
      provider: mockUnlock,
      initial: true,
    },
  ])(
    'preserves the cached profile when $action fails',
    async ({ execute, provider, initial }) => {
      profiles.set('user_guest', { ...profile('user_guest'), locked: initial });
      await getClerkUser('user_guest');
      provider.mockRejectedValueOnce({
        status: 404,
        errors: [{ code: 'resource_not_found' }],
      });
      await expect(execute('user_guest')).rejects.toBeInstanceOf(
        CustomerProviderError
      );
      expect((await getClerkUser('user_guest'))?.locked).toBe(initial);
      expect(mockGetUser).toHaveBeenCalledTimes(1);
      expect(mockDelete).not.toHaveBeenCalled();
    }
  );

  test('keeps the old profile available while a lock is pending', async () => {
    await getClerkUser('user_guest');
    let finish: (value: CustomerClerkSource) => void = () => {
      throw new Error('Missing pending lock');
    };
    mockLock.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        })
    );
    const pending = lockClerkUser('user_guest');
    await Promise.resolve();
    expect((await getClerkUser('user_guest'))?.locked).toBe(false);
    expect(mockGetUser).toHaveBeenCalledTimes(1);
    expect(mockDelete).not.toHaveBeenCalled();
    const locked = { ...profile('user_guest'), locked: true };
    finish(locked);
    await expect(pending).resolves.toBe(locked);
  });
});

test('logs a Redis eviction failure without undoing successful provider locking', async () => {
  mockUseRedis = true;
  await getClerkUser('user_guest');
  const failure = new Error('Redis unavailable');
  mockDelete.mockRejectedValueOnce(failure);
  await expect(lockClerkUser('user_guest')).resolves.toMatchObject({
    locked: true,
  });
  expect(currentProfile('user_guest').locked).toBe(true);
  expect(logger.error).toHaveBeenCalledWith(
    'Redis user cache invalidation failed',
    failure,
    { userId: 'user_guest' }
  );
});
