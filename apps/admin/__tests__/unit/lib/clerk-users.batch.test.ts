// Mock Clerk SDK before importing the module under test
const mockGetUser = jest.fn();
const mockGetUserList = jest.fn();

jest.mock('@clerk/nextjs/server', () => ({
  clerkClient: jest.fn().mockResolvedValue({
    users: {
      getUser: (...args: any[]) => mockGetUser(...args),
      getUserList: (...args: any[]) => mockGetUserList(...args),
    },
  }),
  User: {},
}));

import {
  getClerkUser,
  getClerkUsers,
  getClerkUsersBatch,
} from '@/lib/clerk-users';

// The module keeps an in-memory user cache, so every test uses unique user
// IDs to stay isolated from previously cached entries.
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

beforeEach(() => {
  mockGetUser.mockReset();
  mockGetUserList.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('getClerkUser', () => {
  it('fetches and converts a user', async () => {
    const id = uid();
    mockGetUser.mockResolvedValue(clerkUser(id));

    const customer = await getClerkUser(id);

    expect(customer?.id).toBe(id);
    expect(customer?.email).toBe(`${id}@example.com`);
  });

  it('serves repeat lookups from the cache', async () => {
    const id = uid();
    mockGetUser.mockResolvedValue(clerkUser(id));

    await getClerkUser(id);
    await getClerkUser(id);

    expect(mockGetUser).toHaveBeenCalledTimes(1);
  });

  it('returns null for deleted users (404) and caches the miss', async () => {
    const id = uid();
    mockGetUser.mockRejectedValue({ status: 404 });

    await expect(getClerkUser(id)).resolves.toBeNull();
    await expect(getClerkUser(id)).resolves.toBeNull();
    expect(mockGetUser).toHaveBeenCalledTimes(1);
  });

  it('treats resource_not_found error codes as deleted users', async () => {
    const id = uid();
    mockGetUser.mockRejectedValue({
      errors: [{ code: 'resource_not_found' }],
    });

    await expect(getClerkUser(id)).resolves.toBeNull();
  });

  it('propagates non-404 errors instead of masking them as missing users', async () => {
    const id = uid();
    mockGetUser.mockRejectedValue({ status: 500 });

    await expect(getClerkUser(id)).rejects.toEqual({ status: 500 });
  });

  it('does not cache transient failures', async () => {
    const id = uid();
    mockGetUser
      .mockRejectedValueOnce({ status: 500 })
      .mockResolvedValueOnce(clerkUser(id));

    await expect(getClerkUser(id)).rejects.toEqual({ status: 500 });
    await expect(getClerkUser(id)).resolves.not.toBeNull();
  });
});

describe('getClerkUsersBatch', () => {
  it('fetches every requested user', async () => {
    const ids = [uid('batch'), uid('batch'), uid('batch')];
    mockGetUser.mockImplementation((id: string) =>
      Promise.resolve(clerkUser(id))
    );

    const { users, errors } = await getClerkUsersBatch(ids);

    expect(errors).toBe(0);
    expect(users.size).toBe(3);
    for (const id of ids) {
      expect(users.get(id)?.id).toBe(id);
    }
  });

  it('reuses cached users instead of re-fetching', async () => {
    const cachedId = uid('batch');
    const freshId = uid('batch');
    mockGetUser.mockImplementation((id: string) =>
      Promise.resolve(clerkUser(id))
    );

    await getClerkUser(cachedId); // populate cache
    mockGetUser.mockClear();

    const { users } = await getClerkUsersBatch([cachedId, freshId]);

    expect(users.size).toBe(2);
    expect(mockGetUser).toHaveBeenCalledTimes(1);
    expect(mockGetUser).toHaveBeenCalledWith(freshId);
  });

  it('maps deleted users (404) to null without counting an error', async () => {
    const goneId = uid('batch');
    const okId = uid('batch');
    mockGetUser.mockImplementation((id: string) =>
      id === goneId
        ? Promise.reject({ status: 404 })
        : Promise.resolve(clerkUser(id))
    );

    const { users, errors } = await getClerkUsersBatch([goneId, okId]);

    expect(users.get(goneId)).toBeNull();
    expect(users.get(okId)?.id).toBe(okId);
    expect(errors).toBe(0);
  });

  it('counts transient failures as errors and does not cache them', async () => {
    const flakyId = uid('batch');
    mockGetUser
      .mockRejectedValueOnce({ status: 500 })
      .mockImplementation((id: string) => Promise.resolve(clerkUser(id)));

    const first = await getClerkUsersBatch([flakyId]);
    expect(first.errors).toBe(1);
    expect(first.users.get(flakyId)).toBeNull();

    // Next batch should retry the user instead of serving a cached null
    const second = await getClerkUsersBatch([flakyId]);
    expect(second.errors).toBe(0);
    expect(second.users.get(flakyId)?.id).toBe(flakyId);
  });

  it('respects the CLERK_API_CONCURRENT_LIMIT chunk size', async () => {
    const originalLimit = process.env.CLERK_API_CONCURRENT_LIMIT;
    process.env.CLERK_API_CONCURRENT_LIMIT = '2';

    let active = 0;
    let maxActive = 0;
    mockGetUser.mockImplementation(async (id: string) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise(resolve => setTimeout(resolve, 20));
      active--;
      return clerkUser(id);
    });

    try {
      const ids = Array.from({ length: 5 }, () => uid('batch'));
      const { users } = await getClerkUsersBatch(ids);

      expect(users.size).toBe(5);
      expect(maxActive).toBeLessThanOrEqual(2);
    } finally {
      if (originalLimit === undefined) {
        delete process.env.CLERK_API_CONCURRENT_LIMIT;
      } else {
        process.env.CLERK_API_CONCURRENT_LIMIT = originalLimit;
      }
    }
  });
});

describe('getClerkUsers', () => {
  it('converts the user list and passes through the total count', async () => {
    const id = uid('list');
    mockGetUserList.mockResolvedValue({
      data: [clerkUser(id)],
      totalCount: 42,
    });

    const { data, totalCount } = await getClerkUsers({ limit: 5 });

    expect(totalCount).toBe(42);
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe(id);
    expect(mockGetUserList).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 5, offset: 0, orderBy: '-created_at' })
    );
  });

  it('wraps Clerk failures in a friendly error', async () => {
    mockGetUserList.mockRejectedValue(new Error('network'));

    await expect(getClerkUsers()).rejects.toThrow(
      'Failed to fetch users from Clerk'
    );
  });
});
