import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { PUT as updateBooking } from '@/app/api/bookings/route';
import { PATCH as patchBooking } from '@/app/api/bookings/[id]/route';
import type { auth } from '@clerk/nextjs/server';
import StaffAccess from '@lodgeflow/database/models/StaffAccess';
import { resolveStaffRole } from '@/lib/staff-access';
import { requireApiAuth } from '@/lib/api-utils';
import { PUT } from '@/app/api/staff/route';
const mockAuth = jest.fn<
  Promise<Pick<Awaited<ReturnType<typeof auth>>, 'userId' | 'orgId' | 'has'>>,
  []
>();
const mockMembership = jest.fn<
  Promise<{
    data: { publicUserData: { userId: string } }[];
    totalCount: number;
  }>,
  [{ userId?: string[] }]
>();
const mockClient = jest.fn<
  Promise<{
    organizations: { getOrganizationMembershipList: typeof mockMembership };
  }>,
  []
>();
jest.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
  clerkClient: () => mockClient(),
}));
jest.mock('@lodgeflow/database/mongodb', () =>
  jest.fn().mockResolvedValue(undefined)
);
const actualAuth =
  jest.requireActual<typeof import('@/lib/api-utils')>(
    '@/lib/api-utils'
  ).requireApiAuth;
const organizationId = 'org_lodgeflow';
let members: string[];
const request = (userId: string, role: string | null) =>
  new Request('https://admin.test/api/staff', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, role }),
  });
beforeEach(async () => {
  process.env.LODGEFLOW_STAFF_ORG_ID = organizationId;
  delete process.env.TESTING_AUTH_BYPASS;
  members = ['user_admin', 'user_second', 'user_front', 'user_guest'];
  jest.clearAllMocks();
  mockAuth.mockResolvedValue({
    userId: 'user_admin',
    orgId: organizationId,
    has: () => false,
  });
  mockMembership.mockImplementation(async ({ userId }) => ({
    data: members
      .filter(id => !userId || userId.includes(id))
      .map(id => ({ publicUserData: { userId: id } })),
    totalCount: members.length,
  }));
  mockClient.mockResolvedValue({
    organizations: {
      getOrganizationMembershipList: mockMembership,
    },
  });
  jest.mocked(requireApiAuth).mockImplementation(actualAuth);
  await StaffAccess.init();
  await StaffAccess.create([
    {
      organizationId,
      userId: 'user_admin',
      role: 'admin',
      updatedBy: 'bootstrap',
    },
    {
      organizationId,
      userId: 'user_second',
      role: 'admin',
      updatedBy: 'bootstrap',
    },
    {
      organizationId,
      userId: 'user_front',
      role: 'front_desk',
      updatedBy: 'user_admin',
    },
  ]);
});
afterEach(() => {
  delete process.env.LODGEFLOW_STAFF_ORG_ID;
});
it('requires the configured active organization and a local assignment', async () => {
  expect(
    await resolveStaffRole({
      userId: 'user_admin',
      activeOrganizationId: organizationId,
    })
  ).toBe('admin');
  expect(
    await resolveStaffRole({
      userId: 'user_admin',
      activeOrganizationId: 'org_unrelated',
    })
  ).toBeNull();
  expect(
    await resolveStaffRole({ userId: 'user_admin', activeOrganizationId: null })
  ).toBeNull();
  expect(
    await resolveStaffRole({
      userId: 'user_guest',
      activeOrganizationId: organizationId,
    })
  ).toBeNull();
  delete process.env.LODGEFLOW_STAFF_ORG_ID;
  expect(
    await resolveStaffRole({
      userId: 'user_admin',
      activeOrganizationId: organizationId,
    })
  ).toBeNull();
});
it('revokes access on membership removal and on assignment deletion', async () => {
  members = members.filter(id => id !== 'user_admin');
  expect(
    await resolveStaffRole({
      userId: 'user_admin',
      activeOrganizationId: organizationId,
    })
  ).toBeNull();
  await StaffAccess.deleteOne({ userId: 'user_front' });
  expect(
    await resolveStaffRole({
      userId: 'user_front',
      activeOrganizationId: organizationId,
    })
  ).toBeNull();
});
it('fails closed if Clerk membership lookup fails', async () => {
  mockClient.mockRejectedValue(new Error('offline'));
  expect(
    (await actualAuth({ permission: 'bookings:read' })).authenticated
  ).toBe(false);
});
it('enforces permissions independently of Clerk role claims', async () => {
  mockAuth.mockResolvedValue({
    userId: 'user_front',
    orgId: organizationId,
    has: () => true,
  });
  expect(
    (await actualAuth({ permission: 'bookings:manage' })).authenticated
  ).toBe(true);
  const refundAccess = await actualAuth({ permission: 'refunds:issue' });
  assert(!refundAccess.authenticated);
  expect(refundAccess.error.status).toBe(403);
  const defaultAccess = await actualAuth();
  assert(!defaultAccess.authenticated);
  expect(defaultAccess.error.status).toBe(403);
  expect((await PUT(request('user_guest', 'admin')))?.status).toBe(403);
});
it('allows assignment and revocation, but rejects outsiders and self changes', async () => {
  expect((await PUT(request('user_guest', 'manager')))?.status).toBe(200);
  expect(
    await resolveStaffRole({
      userId: 'user_guest',
      activeOrganizationId: organizationId,
    })
  ).toBe('manager');
  expect((await PUT(request('user_guest', null)))?.status).toBe(200);
  expect(
    await resolveStaffRole({
      userId: 'user_guest',
      activeOrganizationId: organizationId,
    })
  ).toBeNull();
  expect((await PUT(request('user_outsider', 'manager')))?.status).toBe(400);
  expect((await PUT(request('user_admin', null)))?.status).toBe(409);
  expect((await PUT(request('user_guest', 'org:admin')))?.status).toBe(400);
});
it('uniquely scopes assignments to organization and user', async () => {
  await expect(
    StaffAccess.create({
      organizationId,
      userId: 'user_admin',
      role: 'manager',
      updatedBy: 'x',
    })
  ).rejects.toMatchObject({ code: 11000 });
  await StaffAccess.create({
    organizationId: 'org_other',
    userId: 'user_admin',
    role: 'front_desk',
    updatedBy: 'x',
  });
  expect(
    await resolveStaffRole({
      userId: 'user_admin',
      activeOrganizationId: organizationId,
    })
  ).toBe('admin');
});
it('serializes reciprocal administrator revocations without removing both admins', async () => {
  // Simulate both requests having passed their membership checks before either write.
  jest
    .mocked(requireApiAuth)
    .mockResolvedValueOnce({
      authenticated: true,
      userId: 'user_admin',
      role: 'admin',
    })
    .mockResolvedValueOnce({
      authenticated: true,
      userId: 'user_second',
      role: 'admin',
    });
  const responses = await Promise.all([
    PUT(request('user_second', null)),
    PUT(request('user_admin', null)),
  ]);
  expect(responses.map(r => r?.status).sort()).toEqual([200, 403]);
  expect(
    await StaffAccess.countDocuments({ organizationId, role: 'admin' })
  ).toBe(1);
});

it('denies refund-field writes through both booking update endpoints', async () => {
  mockAuth.mockResolvedValue({
    userId: 'user_front',
    orgId: organizationId,
    has: () => false,
  });
  const body = { _id: '507f1f77bcf86cd799439011', refundAmount: 1 };
  const url = 'https://admin.test/api/bookings';
  expect(
    (
      await updateBooking(
        new NextRequest(url, { method: 'PUT', body: JSON.stringify(body) })
      )
    )?.status
  ).toBe(403);
  expect(
    (
      await patchBooking(
        new Request(url, { method: 'PATCH', body: JSON.stringify(body) }),
        { params: Promise.resolve({ id: body._id }) }
      )
    )?.status
  ).toBe(403);
});
