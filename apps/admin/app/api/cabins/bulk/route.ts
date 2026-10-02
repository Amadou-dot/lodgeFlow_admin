import { auditSnapshot, CABIN_AUDIT_FIELDS, recordAudit } from '@/lib/audit';
import type { ApiAuthResult } from '@/lib/api-utils';
import {
  createErrorResponse,
  createSuccessResponse,
  HTTP_STATUS,
  requireApiAuth,
} from '@/lib/api-utils';
import connectDB from '@/lib/mongodb';
import { logger } from '@/lib/logger';
import { readBulkCabinRequest } from '@/lib/validations/bulk-cabin';
import { Booking, Cabin } from '@lodgeflow/database';
import { NextRequest } from 'next/server';

type AuthorizedAccess = Extract<ApiAuthResult, { authenticated: true }>;

export async function POST(request: NextRequest) {
  const authResult = await requireApiAuth({ permission: 'cabins:write' });
  if (!authResult.authenticated) return authResult.error;

  try {
    await connectDB();
    const parsed = await readBulkCabinRequest(request);
    if (!parsed.success) {
      return createErrorResponse(parsed.error, HTTP_STATUS.BAD_REQUEST);
    }

    switch (parsed.data.action) {
      case 'delete':
        return await handleBulkDelete({
          ids: parsed.data.ids,
          access: authResult,
        });
      case 'update-discount':
        return await handleBulkUpdateDiscount({
          ids: parsed.data.ids,
          discount: parsed.data.discount,
          access: authResult,
        });
    }
  } catch (error) {
    logger.error(
      'Bulk cabin operation failed',
      error instanceof Error ? error : undefined
    );
    return createErrorResponse(
      'Bulk operation failed',
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

async function handleBulkDelete({
  ids,
  access,
}: {
  ids: string[];
  access: AuthorizedAccess;
}) {
  // Check for active bookings on any of the selected cabins
  const activeBookings = await Booking.find({
    cabin: { $in: ids },
    status: { $nin: ['cancelled', 'checked-out'] },
  }).populate<{ cabin: { name?: string } | null }>('cabin', 'name');

  if (activeBookings.length > 0) {
    const cabinNames = Array.from(
      new Set(activeBookings.map(booking => booking.cabin?.name || 'Unknown'))
    );

    return createErrorResponse(
      `Cannot delete cabins with active bookings: ${cabinNames.join(', ')}`,
      HTTP_STATUS.CONFLICT
    );
  }

  const cabins = await Cabin.find({ _id: { $in: ids } });
  const result = await Cabin.deleteMany({ _id: { $in: ids } });

  for (const cabin of cabins)
    await recordAudit(access, {
      action: 'cabin.delete',
      resourceType: 'cabin',
      resourceId: String(cabin._id),
      before: auditSnapshot(cabin, CABIN_AUDIT_FIELDS),
      after: {},
    });
  return createSuccessResponse({
    deletedCount: result.deletedCount,
  });
}

async function handleBulkUpdateDiscount({
  ids,
  discount,
  access,
}: {
  ids: string[];
  discount: number;
  access: AuthorizedAccess;
}) {
  // Validate discount doesn't exceed price for any selected cabin
  const cabins = await Cabin.find({ _id: { $in: ids } });
  const invalidCabins = cabins.filter(c => discount >= c.price);

  if (invalidCabins.length > 0) {
    const names = invalidCabins.map(c => `${c.name} ($${c.price})`);
    return createErrorResponse(
      `Discount ($${discount}) exceeds or equals price for: ${names.join(', ')}`,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  const result = await Cabin.updateMany(
    { _id: { $in: ids } },
    { $set: { discount } }
  );

  for (const cabin of cabins)
    await recordAudit(access, {
      action: 'cabin.update',
      resourceType: 'cabin',
      resourceId: String(cabin._id),
      before: { discount: cabin.discount },
      after: { discount },
    });
  return createSuccessResponse({
    modifiedCount: result.modifiedCount,
  });
}
