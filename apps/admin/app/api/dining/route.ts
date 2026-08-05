import {
  createErrorResponse,
  createSuccessResponse,
  createValidationErrorResponse,
  escapeRegex,
  HTTP_STATUS,
  requireApiAuth,
} from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import { createDiningSchema, updateDiningSchema } from '@/lib/validations';
import { connectDB, Dining } from '@/models';
import type { DiningQueryFilter, MongoSortOrder } from '@/types/api';
import { isMongooseValidationError } from '@/types/errors';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  // Require authentication
  const authResult = await requireApiAuth();
  if (!authResult.authenticated) return authResult.error;

  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const mealType = searchParams.get('mealType');
    const category = searchParams.get('category');
    const isAvailable = searchParams.get('isAvailable');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'name';
    const sortOrder = searchParams.get('sortOrder') || 'asc';

    // Build filter object
    const filter: DiningQueryFilter = {};
    if (type) filter.type = type;
    if (mealType) filter.mealType = mealType;
    if (category) filter.category = category;
    if (isAvailable !== null && isAvailable !== undefined)
      filter.isAvailable = isAvailable === 'true';

    // Add search functionality (sanitize to prevent regex injection)
    if (search) {
      const safeSearch = escapeRegex(search);
      // If we have other filters, we need to combine them with $and
      const searchFilter = {
        $or: [
          { name: { $regex: safeSearch, $options: 'i' } },
          { description: { $regex: safeSearch, $options: 'i' } },
          { type: { $regex: safeSearch, $options: 'i' } },
          { category: { $regex: safeSearch, $options: 'i' } },
          { mealType: { $regex: safeSearch, $options: 'i' } },
        ],
      };

      // If we have existing filters, combine them
      if (Object.keys(filter).length > 0) {
        const existingFilters = { ...filter };
        filter.$and = [existingFilters, searchFilter];
        // Remove the individual filter properties since they're now in $and
        Object.keys(existingFilters).forEach(key => delete filter[key]);
      } else {
        // If no other filters, just use the search filter
        Object.assign(filter, searchFilter);
      }
    }

    // Build sort object (whitelist sortable fields — sortBy is user input)
    const SORTABLE_FIELDS = new Set([
      'name',
      'price',
      'type',
      'mealType',
      'category',
      'maxPeople',
      'createdAt',
    ]);
    const sort: MongoSortOrder = {};
    sort[SORTABLE_FIELDS.has(sortBy) ? sortBy : 'name'] =
      sortOrder === 'asc' ? 1 : -1;

    const dining = await Dining.find(filter).sort(sort);

    return createSuccessResponse(dining);
  } catch (error) {
    logger.error(
      'Error fetching dining',
      error instanceof Error ? error : undefined
    );
    return createErrorResponse(
      'Failed to fetch dining items',
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

    const validationResult = createDiningSchema.safeParse(body);
    if (!validationResult.success) {
      return createValidationErrorResponse(validationResult.error);
    }

    const dining = new Dining(validationResult.data);
    await dining.save();

    return createSuccessResponse(
      dining,
      'Dining item created successfully',
      HTTP_STATUS.CREATED
    );
  } catch (error: unknown) {
    if (isMongooseValidationError(error)) {
      return createErrorResponse(
        'Validation failed',
        HTTP_STATUS.BAD_REQUEST,
        error.errors
      );
    }

    logger.error(
      'Error creating dining item',
      error instanceof Error ? error : undefined
    );
    return createErrorResponse(
      'Failed to create dining item',
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

    const validationResult = updateDiningSchema.safeParse(body);
    if (!validationResult.success) {
      return createValidationErrorResponse(validationResult.error);
    }

    const { _id, ...updateData } = validationResult.data;

    const dining = await Dining.findByIdAndUpdate(_id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!dining) {
      return createErrorResponse(
        'Dining item not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    return createSuccessResponse(dining, 'Dining item updated successfully');
  } catch (error: unknown) {
    if (isMongooseValidationError(error)) {
      return createErrorResponse(
        'Validation failed',
        HTTP_STATUS.BAD_REQUEST,
        error.errors
      );
    }

    logger.error(
      'Error updating dining item',
      error instanceof Error ? error : undefined
    );
    return createErrorResponse(
      'Failed to update dining item',
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
        'Dining item ID is required',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const dining = await Dining.findByIdAndDelete(id);

    if (!dining) {
      return createErrorResponse(
        'Dining item not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    return createSuccessResponse(null, 'Dining item deleted successfully');
  } catch (error) {
    logger.error(
      'Error deleting dining item',
      error instanceof Error ? error : undefined
    );
    return createErrorResponse(
      'Failed to delete dining item',
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
