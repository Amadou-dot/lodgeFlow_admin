import { GET as staff, PUT } from '@/app/api/staff/route';
import { GET as audit } from '@/app/api/audit/route';
import StaffAccess from '@lodgeflow/database/models/StaffAccess';
import AuditLog, { AUDIT_ACTIONS } from '@lodgeflow/database/models/AuditLog';
import { requireApiAuth } from '@/lib/api-utils';
import connectDB from '@/lib/mongodb';
import { logger } from '@/lib/logger';

type MemberSource = {
  publicUserData?: {
    userId: string;
    firstName?: string;
    lastName?: string;
    identifier?: string;
  };
};
const mockMembership = jest.fn<
  Promise<{ data: MemberSource[]; totalCount: number }>,
  [{ offset?: number; userId?: string[] }]
>();
jest.mock('@clerk/nextjs/server', () => ({
  clerkClient: async () => ({
    organizations: { getOrganizationMembershipList: mockMembership },
  }),
}));
jest.mock('@/lib/mongodb', () => jest.fn().mockResolvedValue(undefined));
const organizationId = 'org_lodgeflow';
beforeEach(async () => {
  jest.clearAllMocks();
  process.env.LODGEFLOW_STAFF_ORG_ID = organizationId;
  jest.mocked(requireApiAuth).mockResolvedValue({
    authenticated: true,
    userId: 'user_admin',
    role: 'admin',
  });
  mockMembership.mockResolvedValue({
    data: [
      {
        publicUserData: {
          userId: 'user_guest',
          firstName: 'Test',
          lastName: 'Guest',
        },
      },
    ],
    totalCount: 1,
  });
  await StaffAccess.create({
    organizationId,
    userId: 'user_admin',
    role: 'admin',
    updatedBy: 'setup',
  });
});
afterEach(() => {
  delete process.env.LODGEFLOW_STAFF_ORG_ID;
  jest.restoreAllMocks();
});
function json(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

test('staff JSON preserves current-organization assignments, unassigned roles and sparse profiles', async () => {
  await StaffAccess.create({
    organizationId,
    userId: 'user_guest',
    role: 'manager',
    updatedBy: 'user_admin',
  });
  await StaffAccess.create({
    organizationId: 'other',
    userId: 'user_other',
    role: 'admin',
    updatedBy: 'setup',
  });
  mockMembership.mockResolvedValueOnce({
    data: [
      {
        publicUserData: {
          userId: 'user_guest',
          firstName: 'Test',
          lastName: 'Guest',
        },
      },
      {
        publicUserData: {
          userId: 'user_other',
          identifier: 'other@example.invalid',
        },
      },
      {},
    ],
    totalCount: 3,
  });
  const response = await staff();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    success: true,
    data: [
      { userId: 'user_guest', name: 'Test Guest', role: 'manager' },
      { userId: 'user_other', name: 'other@example.invalid', role: null },
      { role: null },
    ],
  });
});

test('audit JSON preserves full lean records, snapshots, timestamps and metadata', async () => {
  const event = await AuditLog.create({
    organizationId,
    actor: 'user_admin',
    actorRole: 'admin',
    action: 'staff.role_change',
    resourceType: 'staff',
    resourceId: 'user_guest',
    before: { role: null },
    after: { role: 'manager' },
    createdAt: new Date('2030-01-01'),
  });
  const stored = await AuditLog.findById(event._id).lean().orFail();
  const response = await audit(new Request('https://admin.test/api/audit'));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    success: true,
    data: {
      events: [json(stored)],
      total: 1,
      page: 1,
      limit: 25,
      actions: AUDIT_ACTIONS,
    },
  });
});

test.each([
  'page=0',
  'page=Infinity',
  'limit=101',
  'action=unknown',
  'actor=' + 'x'.repeat(151),
  'from=invalid',
  'from=2030-01-02&to=2030-01-01',
])('audit rejects %s before database access', async query => {
  const response = await audit(
    new Request(`https://admin.test/api/audit?${query}`)
  );
  expect(response.status).toBe(400);
  expect(connectDB).not.toHaveBeenCalled();
});

test('staff role changes preserve response JSON and actor-attributed audit snapshots', async () => {
  const response = await PUT(
    new Request('https://admin.test/api/staff', {
      method: 'PUT',
      body: JSON.stringify({ userId: 'user_guest', role: 'manager' }),
    })
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    success: true,
    data: { userId: 'user_guest', role: 'manager' },
  });
  expect(await AuditLog.findOne().lean()).toMatchObject({
    actor: 'user_admin',
    actorRole: 'admin',
    organizationId,
    before: { role: null },
    after: { role: 'manager' },
  });
});

test.each([
  '{',
  '{"userId":"user_guest","role":"manager","__proto__":{}}',
  'null',
  JSON.stringify({
    userId: 'user_guest',
    role: 'manager',
    updatedBy: 'forged',
  }),
  JSON.stringify({
    userId: 'user_guest',
    role: 'manager',
    $set: { revision: 0 },
  }),
])(
  'invalid staff payload %s cannot perform membership lookup or writes',
  async body => {
    const before = json(await StaffAccess.find().lean());
    const response = await PUT(
      new Request('https://admin.test/api/staff', { method: 'PUT', body })
    );
    expect(response.status).toBe(400);
    expect(connectDB).not.toHaveBeenCalled();
    expect(mockMembership).not.toHaveBeenCalled();
    expect(json(await StaffAccess.find().lean())).toEqual(before);
    expect(await AuditLog.countDocuments()).toBe(0);
  }
);

test.each(['staff', 'audit'])(
  '%s safely logs unexpected read failures',
  async route => {
    const failure = new Error('private database detail');
    jest.mocked(connectDB).mockRejectedValueOnce(failure);
    const log = jest.spyOn(logger, 'error').mockImplementation(() => {});
    const response = await (route === 'staff'
      ? staff()
      : audit(new Request('https://admin.test/api/audit')));
    const error =
      route === 'staff'
        ? 'Unable to load staff access'
        : 'Unable to load audit history';
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ success: false, error });
    expect(log).toHaveBeenCalledWith(error, failure);
  }
);
