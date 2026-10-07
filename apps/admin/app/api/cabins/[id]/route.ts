import { readJsonRequestBody } from '@/lib/validations/request-body';
import {
  catalogIdSchema,
  withCatalogPathId,
} from '@/lib/validations/catalog-request';
import { serializeCabinDetail } from '@lodgeflow/database/cabin-json';
import { auditSnapshot, CABIN_AUDIT_FIELDS, recordAudit } from '@/lib/audit';
import {
  createErrorResponse,
  createSuccessResponse,
  createValidationErrorResponse,
  HTTP_STATUS,
  requireApiAuth,
} from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import connectDB from '@/lib/mongodb';
import { isDiscountValid, updateCabinSchema } from '@/lib/validations';
import {
  isMongooseValidationError,
  mongooseValidationDetails,
} from '@/lib/mongoose-errors';
import { NextRequest } from 'next/server';
import { Cabin } from '@lodgeflow/database';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Require authentication
  const authResult = await requireApiAuth({ permission: 'bookings:read' });
  if (!authResult.authenticated) return authResult.error;

  try {
    const { id } = await params;
    if (!catalogIdSchema.safeParse(id).success)
      return createErrorResponse('Invalid catalog ID', HTTP_STATUS.BAD_REQUEST);
    await connectDB();

    const cabin = await Cabin.findById(id);

    if (!cabin) {
      return createErrorResponse('Cabin not found', HTTP_STATUS.NOT_FOUND);
    }

    return createSuccessResponse(serializeCabinDetail(cabin));
  } catch (error) {
    logger.error(
      'Error fetching cabin',
      error instanceof Error ? error : undefined
    );
    return createErrorResponse(
      'Failed to fetch cabin',
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Require authentication
  const authResult = await requireApiAuth({ permission: 'cabins:write' });
  if (!authResult.authenticated) return authResult.error;

  try {
    const { id } = await params;

    const json = await readJsonRequestBody(request);
    if (!json.success)
      return createErrorResponse(json.error, HTTP_STATUS.BAD_REQUEST);
    const body = json.data;

    const validationResult = updateCabinSchema.safeParse(
      withCatalogPathId({ body, id })
    );
    if (!validationResult.success) {
      return createValidationErrorResponse(validationResult.error);
    }

    await connectDB();

    const { _id: _validatedId, ...updateData } = validationResult.data;

    // An update touching only `discount` or only `price` has no counterpart
    // in the payload for the schema's refine to check against — fetch the
    // stored value of whichever field is missing and compare against that.
    if (
      (updateData.discount !== undefined) !==
      (updateData.price !== undefined)
    ) {
      const existingCabin = await Cabin.findById(id);
      if (!existingCabin) {
        return createErrorResponse('Cabin not found', HTTP_STATUS.NOT_FOUND);
      }
      const effectiveDiscount = updateData.discount ?? existingCabin.discount;
      const effectivePrice = updateData.price ?? existingCabin.price;
      if (
        !isDiscountValid({ discount: effectiveDiscount, price: effectivePrice })
      ) {
        return createErrorResponse(
          'Validation failed',
          HTTP_STATUS.BAD_REQUEST,
          {
            discount: ['Discount cannot be greater than or equal to the price'],
          }
        );
      }
    }

    const auditBefore = auditSnapshot(
      await Cabin.findById(id),
      CABIN_AUDIT_FIELDS
    );
    const cabin = await Cabin.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!cabin) {
      return createErrorResponse('Cabin not found', HTTP_STATUS.NOT_FOUND);
    }

    await recordAudit(authResult, {
      action: 'cabin.update',
      resourceType: 'cabin',
      resourceId: String(cabin._id),
      before: auditBefore,
      after: auditSnapshot(cabin, CABIN_AUDIT_FIELDS),
    });
    return createSuccessResponse(serializeCabinDetail(cabin));
  } catch (error: unknown) {
    if (isMongooseValidationError(error)) {
      return createErrorResponse(
        'Validation failed',
        HTTP_STATUS.BAD_REQUEST,
        mongooseValidationDetails(error)
      );
    }

    logger.error(
      'Error updating cabin',
      error instanceof Error ? error : undefined
    );
    return createErrorResponse(
      'Failed to update cabin',
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Require authentication
  const authResult = await requireApiAuth({ permission: 'cabins:write' });
  if (!authResult.authenticated) return authResult.error;

  try {
    const { id } = await params;
    if (!catalogIdSchema.safeParse(id).success)
      return createErrorResponse('Invalid catalog ID', HTTP_STATUS.BAD_REQUEST);
    await connectDB();

    const cabin = await Cabin.findByIdAndDelete(id);

    if (!cabin) {
      return createErrorResponse('Cabin not found', HTTP_STATUS.NOT_FOUND);
    }

    await recordAudit(authResult, {
      action: 'cabin.delete',
      resourceType: 'cabin',
      resourceId: String(cabin._id),
      before: auditSnapshot(cabin, CABIN_AUDIT_FIELDS),
      after: {},
    });
    return createSuccessResponse(null, 'Cabin deleted successfully');
  } catch (error) {
    logger.error(
      'Error deleting cabin',
      error instanceof Error ? error : undefined
    );
    return createErrorResponse(
      'Failed to delete cabin',
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
