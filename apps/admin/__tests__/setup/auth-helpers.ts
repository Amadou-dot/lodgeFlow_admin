import { requireApiAuth } from '@/lib/api-utils';
import { NextResponse } from 'next/server';

const mockRequireApiAuth = requireApiAuth as jest.MockedFunction<
  typeof requireApiAuth
>;

export function mockAuthAsAdmin() {
  mockRequireApiAuth.mockResolvedValue({
    authenticated: true,
    userId: 'admin-user-id',
  });
}

export function mockAuthAsCustomer() {
  mockRequireApiAuth.mockResolvedValue({
    authenticated: true,
    userId: 'customer-user-id',
  });
}

export function mockAuthAsUnauthenticated() {
  mockRequireApiAuth.mockResolvedValue({
    authenticated: false,
    error: NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    ) as any,
  });
}
