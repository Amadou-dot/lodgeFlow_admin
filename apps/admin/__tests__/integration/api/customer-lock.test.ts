import { NextRequest } from 'next/server';
import { POST, DELETE } from '@/app/api/customers/[id]/lock/route';
import { lockClerkUser, unlockClerkUser } from '@/lib/clerk-users';
import { CustomerProviderError } from '@/lib/customer-errors';
import { createErrorResponse, requireApiAuth } from '@/lib/api-utils';
import { logger } from '@/lib/logger';

jest.mock('@/lib/clerk-users', () => ({
  lockClerkUser: jest.fn(),
  unlockClerkUser: jest.fn(),
}));
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(requireApiAuth)
    .mockResolvedValue({ authenticated: true, userId: 'staff', role: 'admin' });
});
afterEach(() => jest.restoreAllMocks());

describe.each(['lock', 'unlock'])('%s customer', operation => {
  const execute = operation === 'lock' ? POST : DELETE;
  const dependency = operation === 'lock' ? lockClerkUser : unlockClerkUser;
  const request = () =>
    execute(
      new NextRequest('https://admin.test/api/customers/user_guest/lock'),
      { params: Promise.resolve({ id: 'user_guest' }) }
    );
  test('requires administrator access before the provider call', async () => {
    const error = createErrorResponse('Denied', 403);
    jest
      .mocked(requireApiAuth)
      .mockResolvedValue({ authenticated: false, error });
    expect(await request()).toBe(error);
    expect(requireApiAuth).toHaveBeenCalledWith();
    expect(dependency).not.toHaveBeenCalled();
  });
  test('maps typed missing-user errors to the existing 404 response', async () => {
    jest.mocked(dependency).mockRejectedValueOnce(
      new CustomerProviderError({
        kind: 'not-found',
        message: 'User not found',
      })
    );
    const response = await request();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      success: false,
      error: 'User not found',
    });
  });
  test('logs unexpected failures and returns a safe error', async () => {
    const failure = new Error('private provider detail');
    jest.mocked(dependency).mockRejectedValueOnce(failure);
    const log = jest.spyOn(logger, 'error').mockImplementation(() => {});
    const response = await request();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      error: `Failed to ${operation} user`,
    });
    expect(log).toHaveBeenCalledWith(`Failed to ${operation} user`, failure);
  });
});
