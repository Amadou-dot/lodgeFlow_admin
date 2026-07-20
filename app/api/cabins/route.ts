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
import { isMongooseValidationError } from '@/types/errors';
import { NextRequest } from 'next/server';
import { Cabin } from '../../../models';

export async function GET(request: NextRequest) {
  // Require authentication
  const authResult = await requireApiAuth();
  if (!authResult.authenticated) return authResult.error;

  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter');
    const search = searchParams.get('search');
    const capacity = searchParams.get('capacity');
    const discount = searchParams.get('discount');
    const status = searchParams.get('status');
    const sortBy = searchParams.get('sortBy') || 'name';
    const sortOrder = searchParams.get('sortOrder') || 'asc';

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
    const SORTABLE_FIELDS = new Set([
      'name',
      'price',
      'capacity',
      'discount',
      'status',
      'createdAt',
    ]);
    const sort: MongoSortOrder = {};
    sort[SORTABLE_FIELDS.has(sortBy) ? sortBy : 'name'] =
      sortOrder === 'desc' ? -1 : 1;

    const cabins = await Cabin.find(query).sort(sort);

    return createSuccessResponse(cabins);
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
  const authResult = await requireApiAuth();
  if (!authResult.authenticated) return authResult.error;

  try {
    await connectDB();

    const body = await request.json();

    const validationResult = createCabinSchema.safeParse(body);
    if (!validationResult.success) {
      return createValidationErrorResponse(validationResult.error);
    }

    const cabin = await Cabin.create(validationResult.data);

    return createSuccessResponse(cabin, undefined, HTTP_STATUS.CREATED);
  } catch (error: unknown) {
    // Handle validation errors
    if (isMongooseValidationError(error)) {
      return createErrorResponse(
        'Validation failed',
        HTTP_STATUS.BAD_REQUEST,
        error.errors
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
  const authResult = await requireApiAuth();
  if (!authResult.authenticated) return authResult.error;

  try {
    await connectDB();

    const body = await request.json();

    const validationResult = updateCabinSchema.safeParse(body);
    if (!validationResult.success) {
      return createValidationErrorResponse(validationResult.error);
    }

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
      if (!isDiscountValid(effectiveDiscount, effectivePrice)) {
        return createErrorResponse(
          'Validation failed',
          HTTP_STATUS.BAD_REQUEST,
          {
            discount: ['Discount cannot be greater than or equal to the price'],
          }
        );
      }
    }

    const cabin = await Cabin.findByIdAndUpdate(_id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!cabin) {
      return createErrorResponse('Cabin not found', HTTP_STATUS.NOT_FOUND);
    }

    return createSuccessResponse(cabin);
  } catch (error: unknown) {
    if (isMongooseValidationError(error)) {
      return createErrorResponse(
        'Validation failed',
        HTTP_STATUS.BAD_REQUEST,
        error.errors
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
  const authResult = await requireApiAuth();
  if (!authResult.authenticated) return authResult.error;

  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return createErrorResponse(
        'Cabin ID is required',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const cabin = await Cabin.findByIdAndDelete(id);

    if (!cabin) {
      return createErrorResponse('Cabin not found', HTTP_STATUS.NOT_FOUND);
    }

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
