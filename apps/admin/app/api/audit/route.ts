import AuditLog, {
  AUDIT_ACTIONS,
  type AuditAction,
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
    const params = new URL(request.url).searchParams;
    const page = Number(params.get('page') ?? 1);
    const limit = Number(params.get('limit') ?? 25);
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      page > 10000 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    )
      return createErrorResponse('Invalid pagination', 400);
    const filter: Record<string, unknown> = {
      organizationId: staffOrganizationId(),
    };
    for (const key of ['actor', 'resourceId']) {
      const value = params.get(key);
      if (value) {
        if (value.length > 150)
          return createErrorResponse('Invalid filter', 400);
        filter[key] = value;
      }
    }
    const action = params.get('action');
    if (action) {
      if (!AUDIT_ACTIONS.includes(action as AuditAction))
        return createErrorResponse('Invalid action', 400);
      filter.action = action;
    }
    const dates: Record<string, Date> = {};
    for (const [key, operator] of [
      ['from', '$gte'],
      ['to', '$lte'],
    ]) {
      const value = params.get(key);
      if (!value) continue;
      const date = new Date(value);
      if (Number.isNaN(date.getTime()))
        return createErrorResponse('Invalid date', 400);
      dates[operator] = date;
    }
    if (dates.$gte && dates.$lte && dates.$gte > dates.$lte)
      return createErrorResponse('Invalid date range', 400);
    if (Object.keys(dates).length) filter.createdAt = dates;
    await connectDB();
    const [events, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);
    return createSuccessResponse({
      events,
      total,
      page,
      limit,
      actions: AUDIT_ACTIONS,
    });
  } catch {
    return createErrorResponse('Unable to load audit history', 503);
  }
}
