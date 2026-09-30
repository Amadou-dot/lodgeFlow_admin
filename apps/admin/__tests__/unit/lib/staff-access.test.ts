import { isOrganizationMember, resolveStaffRole } from '@/lib/staff-access';

const mockMembership = jest.fn<
  Promise<{ data: { publicUserData: { userId: string } | null }[] }>,
  [{ organizationId: string; userId: string[]; limit: number }]
>();
const mockClient = jest.fn<
  Promise<{
    organizations: { getOrganizationMembershipList: typeof mockMembership };
  }>,
  []
>();
const mockConnect = jest.fn<Promise<void>, []>();
const mockAssignment = jest.fn<Promise<{ role: unknown } | null>, []>();
const mockFind = jest.fn<
  { lean: typeof mockAssignment },
  [{ organizationId: string; userId: string }]
>();
jest.mock('@clerk/nextjs/server', () => ({ clerkClient: () => mockClient() }));
jest.mock('@/lib/mongodb', () => ({
  __esModule: true,
  default: () => mockConnect(),
}));
jest.mock('@lodgeflow/database/models/StaffAccess', () => ({
  __esModule: true,
  default: {
    findOne: (identity: { organizationId: string; userId: string }) =>
      mockFind(identity),
  },
}));

const organizationId = 'org_lodgeflow';
const userId = 'user_staff';
const originalOrganization = process.env.LODGEFLOW_STAFF_ORG_ID;
beforeEach(() => {
  jest.resetAllMocks();
  process.env.LODGEFLOW_STAFF_ORG_ID = ` ${organizationId} `;
  mockClient.mockResolvedValue({
    organizations: { getOrganizationMembershipList: mockMembership },
  });
  mockMembership.mockResolvedValue({ data: [{ publicUserData: { userId } }] });
  mockConnect.mockResolvedValue(undefined);
  mockFind.mockReturnValue({ lean: mockAssignment });
  mockAssignment.mockResolvedValue({ role: 'manager' });
});
afterEach(() => {
  if (originalOrganization === undefined)
    delete process.env.LODGEFLOW_STAFF_ORG_ID;
  else process.env.LODGEFLOW_STAFF_ORG_ID = originalOrganization;
});

test('membership checks the requested user and organization with a bounded lookup', async () => {
  expect(
    await isOrganizationMember({
      organizationId: organizationId,
      userId: userId,
    })
  ).toBe(true);
  expect(mockMembership).toHaveBeenCalledWith({
    organizationId,
    userId: [userId],
    limit: 1,
  });
  expect(mockConnect).not.toHaveBeenCalled();
});

test.each([
  { name: 'empty membership', data: [] },
  {
    name: 'another user',
    data: [{ publicUserData: { userId: 'user_other' } }],
  },
  { name: 'missing public user', data: [{ publicUserData: null }] },
])('denies $name before accessing MongoDB', async ({ data }) => {
  mockMembership.mockResolvedValue({ data });
  expect(
    await resolveStaffRole({
      userId: userId,
      activeOrganizationId: organizationId,
    })
  ).toBeNull();
  expect(mockConnect).not.toHaveBeenCalled();
  expect(mockFind).not.toHaveBeenCalled();
});

test.each([
  {
    name: 'missing configuration',
    configured: undefined,
    active: organizationId,
  },
  {
    name: 'wrong active organization',
    configured: organizationId,
    active: 'org_other',
  },
  { name: 'no active organization', configured: organizationId, active: null },
])(
  'denies $name before provider or database access',
  async ({ configured, active }) => {
    if (configured === undefined) delete process.env.LODGEFLOW_STAFF_ORG_ID;
    else process.env.LODGEFLOW_STAFF_ORG_ID = configured;
    expect(
      await resolveStaffRole({ userId: userId, activeOrganizationId: active })
    ).toBeNull();
    expect(mockClient).not.toHaveBeenCalled();
    expect(mockConnect).not.toHaveBeenCalled();
  }
);

test.each(['front_desk', 'manager', 'admin'])(
  'resolves assigned %s only after current membership',
  async role => {
    mockAssignment.mockResolvedValue({ role });
    expect(
      await resolveStaffRole({
        userId: userId,
        activeOrganizationId: organizationId,
      })
    ).toBe(role);
    expect(mockMembership).toHaveBeenCalledWith({
      organizationId,
      userId: [userId],
      limit: 1,
    });
    expect(mockFind).toHaveBeenCalledWith({ organizationId, userId });
  }
);

test.each([
  { row: null },
  { row: { role: null } },
  { row: { role: 'org:admin' } },
])('denies absent or invalid application role $row', async ({ row }) => {
  mockAssignment.mockResolvedValue(row);
  expect(
    await resolveStaffRole({
      userId: userId,
      activeOrganizationId: organizationId,
    })
  ).toBeNull();
});

test('membership failure propagates without falling back to a local role', async () => {
  const error = new Error('Membership unavailable');
  mockMembership.mockRejectedValue(error);
  await expect(
    resolveStaffRole({ userId: userId, activeOrganizationId: organizationId })
  ).rejects.toBe(error);
  expect(mockConnect).not.toHaveBeenCalled();
  expect(mockFind).not.toHaveBeenCalled();
});

test('assignment failure propagates rather than granting a role', async () => {
  const error = new Error('Assignment unavailable');
  mockAssignment.mockRejectedValue(error);
  await expect(
    resolveStaffRole({ userId: userId, activeOrganizationId: organizationId })
  ).rejects.toBe(error);
});
