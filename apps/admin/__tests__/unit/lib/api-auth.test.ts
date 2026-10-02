import assert from 'node:assert/strict';
import type { auth } from '@clerk/nextjs/server';
import { requireApiAuth, type ApiAuthResult } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import {
  PERMISSIONS,
  type Permission,
  type StaffRole,
} from '@/lib/permissions';
import type { resolveStaffRole } from '@/lib/staff-access';

type ClerkIdentity = Pick<Awaited<ReturnType<typeof auth>>, 'userId' | 'orgId'>;
const mockAuth = jest.fn<Promise<ClerkIdentity>, []>();
const mockResolveStaffRole = jest.fn<
  ReturnType<typeof resolveStaffRole>,
  Parameters<typeof resolveStaffRole>
>();

jest.mock('@clerk/nextjs/server', () => ({ auth: () => mockAuth() }));
jest.mock('@/lib/staff-access', () => ({
  resolveStaffRole: (...args: Parameters<typeof resolveStaffRole>) =>
    mockResolveStaffRole(...args),
}));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

const roles = ['front_desk', 'manager', 'admin'] as const;
const allowedRoles: Record<Permission, readonly StaffRole[]> = {
  'bookings:read': ['front_desk', 'manager', 'admin'],
  'bookings:manage': ['front_desk', 'manager', 'admin'],
  'cabins:write': ['manager', 'admin'],
  'settings:write': ['manager', 'admin'],
  'refunds:issue': ['manager', 'admin'],
  'audit:read': ['manager', 'admin'],
  'staff:manage': ['admin'],
};
const forbidden = 'Forbidden: Insufficient permissions';

async function expectDenied({
  result,
  status,
  error,
}: {
  result: ApiAuthResult;
  status: number;
  error: string;
}) {
  assert(!result.authenticated);
  assert(result.error);
  expect(Object.keys(result).sort()).toEqual(['authenticated', 'error']);
  expect(result.error.status).toBe(status);
  expect(await result.error.json()).toEqual({ success: false, error });
}

beforeEach(() => {
  jest.resetAllMocks();
  const environment: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: 'test' };
  delete environment.TESTING_AUTH_BYPASS;
  delete environment.NEXT_PUBLIC_TESTING;
  jest.replaceProperty(process, 'env', environment);
  mockAuth.mockResolvedValue({ userId: 'user_staff', orgId: 'org_lodgeflow' });
  mockResolveStaffRole.mockResolvedValue(null);
});
afterEach(() => jest.restoreAllMocks());

describe.each(roles)('requireApiAuth for %s', role => {
  test.each(PERMISSIONS)(
    'enforces %s using the application role',
    async permission => {
      mockResolveStaffRole.mockResolvedValue(role);
      const result = await requireApiAuth({ permission });

      if (allowedRoles[permission].includes(role)) {
        expect(result).toEqual({
          authenticated: true,
          userId: 'user_staff',
          role,
        });
      } else {
        await expectDenied({ result, status: 403, error: forbidden });
      }
      expect(mockResolveStaffRole).toHaveBeenCalledTimes(1);
      expect(mockResolveStaffRole).toHaveBeenCalledWith({
        userId: 'user_staff',
        activeOrganizationId: 'org_lodgeflow',
      });
      expect(logger.error).not.toHaveBeenCalled();
    }
  );

  test.each([undefined, {}])(
    'retains administrator-only default with %j options',
    async options => {
      mockResolveStaffRole.mockResolvedValue(role);
      const result = await requireApiAuth(options);
      if (role === 'admin') {
        expect(result).toEqual({
          authenticated: true,
          userId: 'user_staff',
          role,
        });
      } else {
        await expectDenied({ result, status: 403, error: forbidden });
      }
    }
  );
});

test('denies signed-out callers before looking up staff access', async () => {
  mockAuth.mockResolvedValue({ userId: null, orgId: null });
  await expectDenied({
    result: await requireApiAuth(),
    status: 401,
    error: 'Unauthorized',
  });
  expect(mockResolveStaffRole).not.toHaveBeenCalled();
  expect(logger.error).not.toHaveBeenCalled();
});

test.each([undefined, null, '', 'org_lodgeflow'])(
  'normalizes active organization %j at the lookup boundary',
  async orgId => {
    mockAuth.mockResolvedValue({ userId: 'user_staff', orgId });
    await expectDenied({
      result: await requireApiAuth({ permission: 'bookings:read' }),
      status: 403,
      error: forbidden,
    });
    expect(mockResolveStaffRole).toHaveBeenCalledWith({
      userId: 'user_staff',
      activeOrganizationId: orgId ?? null,
    });
  }
);

describe.each(['Clerk', 'staff lookup'] as const)('%s failure', dependency => {
  test.each([
    new Error('private provider failure'),
    'private provider failure',
  ])('returns a safe 401 and logs the failure', async failure => {
    if (dependency === 'Clerk') mockAuth.mockRejectedValue(failure);
    else mockResolveStaffRole.mockRejectedValue(failure);

    await expectDenied({
      result: await requireApiAuth(),
      status: 401,
      error: 'Authentication failed',
    });
    expect(logger.error).toHaveBeenCalledWith(
      'Auth check failed',
      failure instanceof Error ? failure : undefined
    );
    if (dependency === 'Clerk')
      expect(mockResolveStaffRole).not.toHaveBeenCalled();
  });
});

test.each(['development', 'test'] as const)(
  'permits the server-only local bypass in %s',
  async nodeEnv => {
    jest.replaceProperty(process, 'env', {
      ...process.env,
      NODE_ENV: nodeEnv,
      TESTING_AUTH_BYPASS: 'true',
    });
    expect(await requireApiAuth({ permission: 'staff:manage' })).toEqual({
      authenticated: true,
      userId: 'test-user',
      role: 'admin',
    });
    expect(mockAuth).not.toHaveBeenCalled();
    expect(mockResolveStaffRole).not.toHaveBeenCalled();
  }
);

test.each(['false', 'TRUE', '1', ''])(
  'rejects non-exact bypass flag %j and ignores the public flag',
  async flag => {
    process.env.TESTING_AUTH_BYPASS = flag;
    process.env.NEXT_PUBLIC_TESTING = 'true';
    mockAuth.mockResolvedValue({ userId: null, orgId: null });
    await expectDenied({
      result: await requireApiAuth(),
      status: 401,
      error: 'Unauthorized',
    });
    expect(mockAuth).toHaveBeenCalledTimes(1);
  }
);

test('ignores the public flag when the server flag is absent', async () => {
  process.env.NEXT_PUBLIC_TESTING = 'true';
  mockAuth.mockResolvedValue({ userId: null, orgId: null });
  await expectDenied({
    result: await requireApiAuth(),
    status: 401,
    error: 'Unauthorized',
  });
  expect(mockAuth).toHaveBeenCalledTimes(1);
});

test('rejects production bypass for signed-out callers', async () => {
  jest.replaceProperty(process, 'env', {
    ...process.env,
    NODE_ENV: 'production',
    TESTING_AUTH_BYPASS: 'true',
  });
  mockAuth.mockResolvedValue({ userId: null, orgId: null });
  await expectDenied({
    result: await requireApiAuth(),
    status: 401,
    error: 'Unauthorized',
  });
  expect(mockAuth).toHaveBeenCalledTimes(1);
  expect(mockResolveStaffRole).not.toHaveBeenCalled();
});

test.each(roles)(
  'enforces normal production authorization for %s even with bypass enabled',
  async role => {
    jest.replaceProperty(process, 'env', {
      ...process.env,
      NODE_ENV: 'production',
      TESTING_AUTH_BYPASS: 'true',
    });
    mockResolveStaffRole.mockResolvedValue(role);
    const result = await requireApiAuth();
    if (role === 'admin')
      expect(result).toEqual({
        authenticated: true,
        userId: 'user_staff',
        role,
      });
    else await expectDenied({ result, status: 403, error: forbidden });
    expect(mockAuth).toHaveBeenCalledTimes(1);
    expect(mockResolveStaffRole).toHaveBeenCalledTimes(1);
  }
);
