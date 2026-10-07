import { cabinQuerySchema } from '@/lib/validations/catalog-query';
import { readJsonRequestBody } from '@/lib/validations/request-body';
import { catalogIdSchema } from '@/lib/validations/catalog-request';
import { serializeCabinDetail } from '@lodgeflow/database/cabin-json';
import { auditSnapshot, CABIN_AUDIT_FIELDS, recordAudit } from '@/lib/audit';
import {
  createErrorResponse,
  createSuccessResponse,
  createValidationErrorResponse,
  escapeRegex,
  HTTP_STATUS,
  requireApiAuth,
} from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import connectDB from '@/lib/mongodb';
import {
  createCabinSchema,
  isDiscountValid,
  updateCabinSchema,
} from '@/lib/validations';
import type { CabinQueryFilter, MongoSortOrder } from '@/types/api';
import {
  isMongooseValidationError,
  mongooseValidationDetails,
} from '@/lib/mongoose-errors';
import { NextRequest } from 'next/server';
import { Cabin } from '@lodgeflow/database';

export async function GET(request: NextRequest) {
  // Require authentication
  const authResult = await requireApiAuth({ permission: 'bookings:read' });
  if (!authResult.authenticated) return authResult.error;

  try {
    const { searchParams } = new URL(request.url);
    const { filter, search, capacity, discount, status, sortBy, sortOrder } =
      cabinQuerySchema.parse({
        filter: searchParams.get('filter'),
        search: searchParams.get('search'),
        capacity: searchParams.get('capacity'),
        discount: searchParams.get('discount'),
        status: searchParams.get('status'),
        sortBy: searchParams.get('sortBy'),
        sortOrder: searchParams.get('sortOrder'),
      });

    await connectDB();

    // Build query
    const query: CabinQueryFilter = {};

    // Apply status filter (default to active only unless explicitly requesting all or specific status)
    if (status && status !== 'all') {
      query.status = status;
    }

    // Apply search (sanitize to prevent regex injection)
    if (search) {
      query.name = { $regex: escapeRegex(search), $options: 'i' };
    }

    // Apply capacity filter
    if (capacity) {
      switch (capacity) {
        case 'small':
          query.capacity = { $lte: 3 };
          break;
        case 'medium':
          query.capacity = { $gte: 4, $lte: 7 };
          break;
        case 'large':
          query.capacity = { $gte: 8 };
          break;
      }
    }

    // Apply discount filter
    if (discount) {
      switch (discount) {
        case 'with':
          query.discount = { $gt: 0 };
          break;
        case 'without':
          query.discount = 0;
          break;
      }
    }

    // Apply legacy filters for backward compatibility
    if (filter) {
      switch (filter) {
        case 'with-discount':
          query.discount = { $gt: 0 };
          break;
        case 'no-discount':
          query.discount = 0;
          break;
        case 'small':
          query.capacity = { $lte: 3 };
          break;
        case 'medium':
          query.capacity = { $gte: 4, $lte: 6 };
          break;
        case 'large':
          query.capacity = { $gte: 7 };
          break;
      }
    }

    // Build sort object (whitelist sortable fields — sortBy is user input)
    const sort: MongoSortOrder = { [sortBy]: sortOrder };

    const cabins = await Cabin.find(query).sort(sort);

    return createSuccessResponse(cabins.map(serializeCabinDetail));
  } catch (error) {
    logger.error(
      'Error fetching cabins',
      error instanceof Error ? error : undefined
    );
    return createErrorResponse(
      'Failed to fetch cabins',
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

export async function POST(request: NextRequest) {
  // Require authentication
  const authResult = await requireApiAuth({ permission: 'cabins:write' });
  if (!authResult.authenticated) return authResult.error;

  try {
    const json = await readJsonRequestBody(request);
    if (!json.success)
      return createErrorResponse(json.error, HTTP_STATUS.BAD_REQUEST);
    const body = json.data;

    const validationResult = createCabinSchema.safeParse(body);
    if (!validationResult.success) {
      return createValidationErrorResponse(validationResult.error);
    }

    await connectDB();

    const cabin = await Cabin.create(validationResult.data);

    await recordAudit(authResult, {
      action: 'cabin.create',
      resourceType: 'cabin',
      resourceId: String(cabin._id),
      before: {},
      after: auditSnapshot(cabin, CABIN_AUDIT_FIELDS),
    });
    return createSuccessResponse(
      serializeCabinDetail(cabin),
      undefined,
      HTTP_STATUS.CREATED
    );
  } catch (error: unknown) {
    // Handle validation errors
    if (isMongooseValidationError(error)) {
      return createErrorResponse(
        'Validation failed',
        HTTP_STATUS.BAD_REQUEST,
        mongooseValidationDetails(error)
      );
    }

    logger.error(
      'Error creating cabin',
      error instanceof Error ? error : undefined
    );
    return createErrorResponse(
      'Failed to create cabin',
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

export async function PUT(request: NextRequest) {
  // Require authentication
  const authResult = await requireApiAuth({ permission: 'cabins:write' });
  if (!authResult.authenticated) return authResult.error;

  try {
    const json = await readJsonRequestBody(request);
    if (!json.success)
      return createErrorResponse(json.error, HTTP_STATUS.BAD_REQUEST);
    const body = json.data;

    const validationResult = updateCabinSchema.safeParse(body);
    if (!validationResult.success) {
      return createValidationErrorResponse(validationResult.error);
    }

    await connectDB();

    const { _id, ...updateData } = validationResult.data;

    // An update touching only `discount` or only `price` has no counterpart
    // in the payload for the schema's refine to check against — fetch the
    // stored value of whichever field is missing and compare against that.
    if (
      (updateData.discount !== undefined) !==
      (updateData.price !== undefined)
    ) {
      const existingCabin = await Cabin.findById(_id);
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
      await Cabin.findById(_id),
      CABIN_AUDIT_FIELDS
    );
    const cabin = await Cabin.findByIdAndUpdate(_id, updateData, {
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

export async function DELETE(request: NextRequest) {
  // Require authentication
  const authResult = await requireApiAuth({ permission: 'cabins:write' });
  if (!authResult.authenticated) return authResult.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return createErrorResponse(
        'Cabin ID is required',
        HTTP_STATUS.BAD_REQUEST
      );
    }

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
