import type { FilterQuery } from 'mongoose';
import type { AuditHistoryJson } from '@/types/staff-audit';
import { serializeAuditEvent } from '@/lib/serializers/audit';
import { parseAuditQuery } from '@/lib/validations/staff-audit';
import { logger } from '@/lib/logger';
import AuditLog, {
  AUDIT_ACTIONS,
  type IAuditLog,
} from '@lodgeflow/database/models/AuditLog';
import {
  createErrorResponse,
  createSuccessResponse,
  requireApiAuth,
} from '@/lib/api-utils';
import connectDB from '@/lib/mongodb';
import { staffOrganizationId } from '@/lib/staff-access';
export async function GET(request: Request) {
  const access = await requireApiAuth({ permission: 'audit:read' });
  if (!access.authenticated) return access.error;
  try {
    const parsed = parseAuditQuery(new URL(request.url).searchParams);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return createErrorResponse(
        issue.path[0] === 'page' || issue.path[0] === 'limit'
          ? 'Invalid pagination'
          : issue.message,
        400
      );
    }
    const { page, limit, actor, resourceId, action, from, to } = parsed.data;
    const organizationId = staffOrganizationId();
    if (!organizationId)
      throw new Error('Staff organization is not configured');
    const filter: FilterQuery<IAuditLog> = { organizationId };
    if (actor) filter.actor = actor;
    if (resourceId) filter.resourceId = resourceId;
    if (action) filter.action = action;
    if (from || to)
      filter.createdAt = {
        ...(from && { $gte: from }),
        ...(to && { $lte: to }),
      };
    await connectDB();
    const [events, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);
    return createSuccessResponse<AuditHistoryJson>({
      events: events.map(serializeAuditEvent),
      total,
      page,
      limit,
      actions: AUDIT_ACTIONS,
    });
  } catch (error: unknown) {
    logger.error('Unable to load audit history', error);
    return createErrorResponse('Unable to load audit history', 503);
  }
}
