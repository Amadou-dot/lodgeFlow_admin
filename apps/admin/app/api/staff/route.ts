import { recordAudit } from '@/lib/audit';
import { clerkClient } from '@clerk/nextjs/server';
import mongoose from 'mongoose';
import StaffAccess from '@lodgeflow/database/models/StaffAccess';
import {
  createErrorResponse,
  createSuccessResponse,
  requireApiAuth,
} from '@/lib/api-utils';
import { isStaffRole } from '@/lib/permissions';
import { isOrganizationMember, staffOrganizationId } from '@/lib/staff-access';
import connectDB from '@/lib/mongodb';

export async function GET() {
  const access = await requireApiAuth({ permission: 'staff:manage' });
  if (!access.authenticated) return access.error;
  try {
    const organizationId = staffOrganizationId()!;
    await connectDB();
    const assignments = await StaffAccess.find({ organizationId }).lean();
    const client = await clerkClient();
    const members = [];
    for (let offset = 0; ; offset += 100) {
      const page = await client.organizations.getOrganizationMembershipList({
        organizationId,
        limit: 100,
        offset,
      });
      members.push(...page.data);
      if (
        offset + page.data.length >= page.totalCount ||
        page.data.length === 0
      )
        break;
    }
    return createSuccessResponse(
      members.map(member => ({
        userId: member.publicUserData?.userId,
        name:
          [member.publicUserData?.firstName, member.publicUserData?.lastName]
            .filter(Boolean)
            .join(' ') || member.publicUserData?.identifier,
        role:
          assignments.find(
            item => item.userId === member.publicUserData?.userId
          )?.role ?? null,
      }))
    );
  } catch {
    return createErrorResponse('Unable to load staff access', 503);
  }
}

export async function PUT(request: Request) {
  const access = await requireApiAuth({ permission: 'staff:manage' });
  if (!access.authenticated) return access.error;
  try {
    const body = await request.json();
    if (
      typeof body.userId !== 'string' ||
      !body.userId.startsWith('user_') ||
      (body.role !== null && !isStaffRole(body.role))
    ) {
      return createErrorResponse('Choose a member and a valid staff role', 400);
    }
    if (body.userId === access.userId)
      return createErrorResponse('You cannot change your own access', 409);
    const organizationId = staffOrganizationId()!;
    if (
      body.role !== null &&
      !(await isOrganizationMember(organizationId, body.userId))
    ) {
      return createErrorResponse(
        'The user must belong to the LodgeFlow organization',
        400
      );
    }
    await connectDB();
    await StaffAccess.init();
    let authorized = false;
    let previousRole: string | null = null;
    await mongoose.connection.transaction(async session => {
      // Write to the actor as well as the target: concurrent revocation of this
      // administrator conflicts and retries with fresh authorization.
      const actor = await StaffAccess.findOneAndUpdate(
        { organizationId, userId: access.userId, role: 'admin' },
        { $inc: { revision: 1 } },
        { session, new: true }
      );
      authorized = Boolean(actor);
      if (!actor) return;
      previousRole =
        (
          await StaffAccess.findOne({
            organizationId,
            userId: body.userId,
          }).session(session)
        )?.role ?? null;
      if (body.role === null) {
        await StaffAccess.deleteOne(
          { organizationId, userId: body.userId },
          { session }
        );
      } else {
        await StaffAccess.findOneAndUpdate(
          { organizationId, userId: body.userId },
          { $set: { role: body.role, updatedBy: access.userId } },
          { upsert: true, runValidators: true, session }
        );
      }
    });
    if (!authorized)
      return createErrorResponse(
        'Staff administration access was revoked',
        403
      );
    await recordAudit(access, {
      action: 'staff.role_change',
      resourceType: 'staff',
      resourceId: body.userId,
      before: { role: previousRole },
      after: { role: body.role },
    });
    return createSuccessResponse({ userId: body.userId, role: body.role });
  } catch {
    return createErrorResponse('Unable to update staff access', 503);
  }
}
