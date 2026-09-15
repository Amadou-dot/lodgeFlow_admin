import { clerkClient } from '@clerk/nextjs/server';
import StaffAccess from '@lodgeflow/database/models/StaffAccess';
import connectDB from '@/lib/mongodb';
import { isStaffRole, type StaffRole } from './permissions';

export function staffOrganizationId(): string | undefined {
  return process.env.LODGEFLOW_STAFF_ORG_ID?.trim() || undefined;
}
export async function isOrganizationMember(
  organizationId: string,
  userId: string
): Promise<boolean> {
  const client = await clerkClient();
  const result = await client.organizations.getOrganizationMembershipList({
    organizationId,
    userId: [userId],
    limit: 1,
  });
  return result.data.some(member => member.publicUserData?.userId === userId);
}
export async function resolveStaffRole(
  userId: string,
  activeOrganizationId: string | null | undefined
): Promise<StaffRole | null> {
  const organizationId = staffOrganizationId();
  if (!organizationId || activeOrganizationId !== organizationId) return null;
  // Never authorize from a stale session's role claim or a customer-editable profile.
  if (!(await isOrganizationMember(organizationId, userId))) return null;
  await connectDB();
  const assignment = await StaffAccess.findOne({
    organizationId,
    userId,
  }).lean();
  return isStaffRole(assignment?.role) ? assignment.role : null;
}
