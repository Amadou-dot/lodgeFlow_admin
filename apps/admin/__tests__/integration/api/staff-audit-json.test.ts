import { GET as staff, PUT } from '@/app/api/staff/route';
import { GET as audit } from '@/app/api/audit/route';
import StaffAccess from '@lodgeflow/database/models/StaffAccess';
import AuditLog, { AUDIT_ACTIONS } from '@lodgeflow/database/models/AuditLog';
import { requireApiAuth } from '@/lib/api-utils';
import connectDB from '@/lib/mongodb';
import { logger } from '@/lib/logger';
import {
  auditHistoryJsonSchema,
  readStaffAuditResponse,
  staffAccessJsonSchema,
  staffRoleChangeJsonSchema,
  staffRosterJsonSchema,
} from '@/lib/validations/staff-audit-json';

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
      { publicUserData: { userId: 'user_without_name' } },
      {},
    ],
    totalCount: 4,
  });
  const response = await staff();
  expect(response.status).toBe(200);
  const expected = [
    { userId: 'user_guest', name: 'Test Guest', role: 'manager' },
    { userId: 'user_other', name: 'other@example.invalid', role: null },
    { userId: 'user_without_name', role: null },
    { role: null },
  ];
  expect(await response.clone().json()).toStrictEqual({
    success: true,
    data: expected,
  });
  await expect(
    readStaffAuditResponse({
      response,
      schema: staffRosterJsonSchema,
      fallback: 'Invalid staff roster',
    })
  ).resolves.toStrictEqual(expected);
});

test('audit JSON preserves full lean records, snapshots, timestamps and metadata', async () => {
  const event = await AuditLog.create({
    organizationId,
    actor: 'user_admin',
    actorRole: 'admin',
    action: 'staff.role_change',
    resourceType: 'staff',
    resourceId: 'user_guest',
    before: { role: null, legacy: [{ name: 'setting', value: null }, true, 1] },
    after: { role: 'manager', legacy: { nested: [null, 'value'] } },
    createdAt: new Date('+010000-01-01T00:00:00.000Z'),
  });
  const stored = await AuditLog.findById(event._id).lean().orFail();
  const response = await audit(new Request('https://admin.test/api/audit'));
  expect(response.status).toBe(200);
  const expected = {
    events: [json(stored)],
    total: 1,
    page: 1,
    limit: 25,
    actions: AUDIT_ACTIONS,
  };
  expect(await response.clone().json()).toStrictEqual({
    success: true,
    data: expected,
  });
  await expect(
    readStaffAuditResponse({
      response,
      schema: auditHistoryJsonSchema,
      fallback: 'Invalid audit history',
    })
  ).resolves.toStrictEqual(expected);
});

test.each([
  {
    resource: 'staff access',
    schema: staffAccessJsonSchema,
    data: {
      userId: 'user_guest',
      role: 'front_desk',
      permissions: ['bookings:read', 'bookings:manage'],
      accessMetadata: { source: 'assignment' },
    },
  },
  {
    resource: 'staff roster',
    schema: staffRosterJsonSchema,
    data: [
      { userId: 'user_guest', role: null, displayMetadata: { verified: true } },
      { role: null, source: 'sparse profile' },
    ],
  },
  {
    resource: 'staff role acknowledgement',
    schema: staffRoleChangeJsonSchema,
    data: {
      userId: 'user_guest',
      role: null,
      assignmentMetadata: { revision: 2 },
    },
  },
])('preserves additive fields in $resource', async ({ schema, data }) => {
  const response = Response.json({ success: true, data });
  await expect(
    readStaffAuditResponse<unknown>({
      response,
      schema,
      fallback: 'Invalid staff response',
    })
  ).resolves.toStrictEqual(data);
});

const emptyAuditPage = {
  events: [],
  total: 0,
  page: 1,
  limit: 25,
  actions: ['staff.role_change'],
};

test('preserves additive audit history and event data', async () => {
  const data = {
    ...emptyAuditPage,
    auditMetadata: { nextCursor: null },
    total: 1,
    events: [
      {
        _id: '507f1f77bcf86cd799439011',
        organizationId,
        actor: 'user_admin',
        actorRole: 'admin',
        action: 'staff.role_change',
        resourceType: 'staff',
        resourceId: 'user_guest',
        before: { role: 'manager', ['__proto__']: { opaque: true } },
        after: { role: null },
        createdAt: '2030-01-01T00:00:00.000Z',
        eventMetadata: { correlation: ['request_1', null] },
      },
    ],
  };
  await expect(
    readStaffAuditResponse({
      response: Response.json({ success: true, data }),
      schema: auditHistoryJsonSchema,
      fallback: 'Invalid audit history',
    })
  ).resolves.toStrictEqual(data);
});

test('accepts positive audit read pagination above the current request caps', async () => {
  const data = { ...emptyAuditPage, page: 10001, limit: 101 };
  await expect(
    readStaffAuditResponse({
      response: Response.json({ success: true, data }),
      schema: auditHistoryJsonSchema,
      fallback: 'Invalid audit history',
    })
  ).resolves.toStrictEqual(data);
});

test.each([{ page: 0 }, { limit: 0 }, { page: 1.5 }, { limit: 1.5 }])(
  'rejects invalid audit pagination metadata %j',
  async fields => {
    await expect(
      readStaffAuditResponse({
        response: Response.json({
          success: true,
          data: { ...emptyAuditPage, ...fields },
        }),
        schema: auditHistoryJsonSchema,
        fallback: 'Invalid audit history',
      })
    ).rejects.toThrow('Invalid audit history');
  }
);

test.each([
  'page=0',
  'page=10001',
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
  await expect(
    readStaffAuditResponse({
      response,
      schema: staffRoleChangeJsonSchema,
      fallback: 'Invalid role change',
    })
  ).resolves.toStrictEqual({ userId: 'user_guest', role: 'manager' });
  expect(await AuditLog.findOne().lean()).toMatchObject({
    actor: 'user_admin',
    actorRole: 'admin',
    organizationId,
    before: { role: null },
    after: { role: 'manager' },
  });

  const revoke = await PUT(
    new Request('https://admin.test/api/staff', {
      method: 'PUT',
      body: JSON.stringify({ userId: 'user_guest', role: null }),
    })
  );
  expect(revoke.status).toBe(200);
  expect(await revoke.clone().json()).toStrictEqual({
    success: true,
    data: { userId: 'user_guest', role: null },
  });
  await expect(
    readStaffAuditResponse({
      response: revoke,
      schema: staffRoleChangeJsonSchema,
      fallback: 'Invalid role revocation',
    })
  ).resolves.toStrictEqual({ userId: 'user_guest', role: null });
  expect(await AuditLog.findOne({ 'after.role': null }).lean()).toMatchObject({
    actor: 'user_admin',
    actorRole: 'admin',
    organizationId,
    before: { role: 'manager' },
    after: { role: null },
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
