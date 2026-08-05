import {
  createErrorResponse,
  createSuccessResponse,
  HTTP_STATUS,
  requireApiAuth,
} from '@/lib/api-utils';
import connectDB from '@/lib/mongodb';
import { Booking, Cabin } from '@/models';
import { NextRequest } from 'next/server';

const MAX_BULK_ITEMS = 50;
const OBJECT_ID_REGEX = /^[a-f0-9]{24}$/i;

export async function POST(request: NextRequest) {
  const authResult = await requireApiAuth();
  if (!authResult.authenticated) return authResult.error;

  try {
    await connectDB();
    const body = await request.json();
    const { action, ids } = body;

    if (!action || !ids || !Array.isArray(ids) || ids.length === 0) {
      return createErrorResponse(
        'action and ids (non-empty array) are required',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    if (
      !ids.every(
        (id: unknown) => typeof id === 'string' && OBJECT_ID_REGEX.test(id)
      )
    ) {
      return createErrorResponse(
        'Each id must be a valid ObjectId string',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    if (ids.length > MAX_BULK_ITEMS) {
      return createErrorResponse(
        `Cannot process more than ${MAX_BULK_ITEMS} items at once`,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    switch (action) {
      case 'delete':
        return handleBulkDelete(ids);
      case 'update-discount':
        return handleBulkUpdateDiscount(ids, body.discount);
      default:
        return createErrorResponse(
          `Unknown action: ${action}`,
          HTTP_STATUS.BAD_REQUEST
        );
    }
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Bulk operation failed',
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

async function handleBulkDelete(ids: string[]) {
  // Check for active bookings on any of the selected cabins
  const activeBookings = await Booking.find({
    cabin: { $in: ids },
    status: { $nin: ['cancelled', 'checked-out'] },
  }).populate('cabin', 'name');

  if (activeBookings.length > 0) {
    const cabinNames = Array.from(
      new Set(
        activeBookings.map(b => {
          const cabin = b.cabin as unknown as { name: string };
          return cabin?.name || 'Unknown';
        })
      )
    );

    return createErrorResponse(
      `Cannot delete cabins with active bookings: ${cabinNames.join(', ')}`,
      HTTP_STATUS.CONFLICT
    );
  }

  const result = await Cabin.deleteMany({ _id: { $in: ids } });

  return createSuccessResponse({
    deletedCount: result.deletedCount,
  });
}

async function handleBulkUpdateDiscount(ids: string[], discount: number) {
  if (
    discount === undefined ||
    discount === null ||
    typeof discount !== 'number'
  ) {
    return createErrorResponse(
      'discount (number) is required',
      HTTP_STATUS.BAD_REQUEST
    );
  }

  if (discount < 0) {
    return createErrorResponse(
      'Discount must be a non-negative number',
      HTTP_STATUS.BAD_REQUEST
    );
  }

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

  return createSuccessResponse({
    modifiedCount: result.modifiedCount,
  });
}
