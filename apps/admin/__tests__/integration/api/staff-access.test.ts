import { NextRequest } from 'next/server';
import { PUT as updateBooking } from '@/app/api/bookings/route';
import { PATCH as patchBooking } from '@/app/api/bookings/[id]/route';
import { auth, clerkClient } from '@clerk/nextjs/server';
import StaffAccess from '@lodgeflow/database/models/StaffAccess';
import { resolveStaffRole } from '@/lib/staff-access';
import { requireApiAuth } from '@/lib/api-utils';
import { PUT } from '@/app/api/staff/route';
jest.mock('@lodgeflow/database/mongodb', () =>
  jest.fn().mockResolvedValue(undefined)
);
const actualAuth = jest.requireActual('@/lib/api-utils')
  .requireApiAuth as typeof requireApiAuth;
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
  (auth as unknown as jest.Mock).mockResolvedValue({
    userId: 'user_admin',
    orgId: organizationId,
  });
  (clerkClient as unknown as jest.Mock).mockResolvedValue({
    organizations: {
      getOrganizationMembershipList: jest.fn(
        async ({ userId }: { userId?: string[] }) => ({
          data: members
            .filter(id => !userId || userId.includes(id))
            .map(id => ({ publicUserData: { userId: id } })),
          totalCount: members.length,
        })
      ),
    },
  });
  (requireApiAuth as jest.Mock).mockImplementation(actualAuth);
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
  expect(await resolveStaffRole('user_admin', organizationId)).toBe('admin');
  expect(await resolveStaffRole('user_admin', 'org_unrelated')).toBeNull();
  expect(await resolveStaffRole('user_admin', null)).toBeNull();
  expect(await resolveStaffRole('user_guest', organizationId)).toBeNull();
  delete process.env.LODGEFLOW_STAFF_ORG_ID;
  expect(await resolveStaffRole('user_admin', organizationId)).toBeNull();
});
it('revokes access on membership removal and on assignment deletion', async () => {
  members = members.filter(id => id !== 'user_admin');
  expect(await resolveStaffRole('user_admin', organizationId)).toBeNull();
  await StaffAccess.deleteOne({ userId: 'user_front' });
  expect(await resolveStaffRole('user_front', organizationId)).toBeNull();
});
it('fails closed if Clerk membership lookup fails', async () => {
  (clerkClient as unknown as jest.Mock).mockRejectedValue(new Error('offline'));
  expect(
    (await actualAuth({ permission: 'bookings:read' })).authenticated
  ).toBe(false);
});
it('enforces permissions independently of Clerk role claims', async () => {
  (auth as unknown as jest.Mock).mockResolvedValue({
    userId: 'user_front',
    orgId: organizationId,
    has: () => true,
  });
  expect(
    (await actualAuth({ permission: 'bookings:manage' })).authenticated
  ).toBe(true);
  expect(
    (await actualAuth({ permission: 'refunds:issue' })).error?.status
  ).toBe(403);
  expect((await actualAuth()).error?.status).toBe(403);
  expect((await PUT(request('user_guest', 'admin')))?.status).toBe(403);
});
it('allows assignment and revocation, but rejects outsiders and self changes', async () => {
  expect((await PUT(request('user_guest', 'manager')))?.status).toBe(200);
  expect(await resolveStaffRole('user_guest', organizationId)).toBe('manager');
  expect((await PUT(request('user_guest', null)))?.status).toBe(200);
  expect(await resolveStaffRole('user_guest', organizationId)).toBeNull();
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
  expect(await resolveStaffRole('user_admin', organizationId)).toBe('admin');
});
it('serializes reciprocal administrator revocations without removing both admins', async () => {
  // Simulate both requests having passed their membership checks before either write.
  (requireApiAuth as jest.Mock)
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
  (auth as unknown as jest.Mock).mockResolvedValue({
    userId: 'user_front',
    orgId: organizationId,
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
