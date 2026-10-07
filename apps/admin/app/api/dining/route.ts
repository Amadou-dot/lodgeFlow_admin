import { diningQuerySchema } from '@/lib/validations/catalog-query';
import { readJsonRequestBody } from '@/lib/validations/request-body';
import { catalogIdSchema } from '@/lib/validations/catalog-request';
import {
  serializeDining,
  type DiningJsonSource,
} from '@lodgeflow/database/dining-json';
import type { Model } from 'mongoose';
import {
  updateCapacityCatalog,
  deleteCapacityCatalog,
  ReservationRuleError,
} from '@lodgeflow/database/reservation-capacity';
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
import { connectDB, Dining } from '@lodgeflow/database';
import type { DiningQueryFilter, MongoSortOrder } from '@/types/api';
import {
  isMongooseValidationError,
  mongooseValidationDetails,
} from '@/lib/mongoose-errors';
import { NextRequest } from 'next/server';

const diningReader: Model<DiningJsonSource> = Dining;

export async function GET(request: NextRequest) {
  // Require authentication
  const authResult = await requireApiAuth({ permission: 'bookings:read' });
  if (!authResult.authenticated) return authResult.error;

  try {
    const { searchParams } = new URL(request.url);
    const { type, mealType, category, isAvailable, search, sortBy, sortOrder } =
      diningQuerySchema.parse({
        type: searchParams.get('type'),
        mealType: searchParams.get('mealType'),
        category: searchParams.get('category'),
        isAvailable: searchParams.get('isAvailable'),
        search: searchParams.get('search'),
        sortBy: searchParams.get('sortBy'),
        sortOrder: searchParams.get('sortOrder'),
      });

    await connectDB();

    // Build filter object
    const filter: DiningQueryFilter = {};
    if (type) filter.type = type;
    if (mealType) filter.mealType = mealType;
    if (category) filter.category = category;
    if (isAvailable !== undefined) filter.isAvailable = isAvailable;

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
    const sort: MongoSortOrder = { [sortBy]: sortOrder };

    const dining = await diningReader.find(filter).sort(sort);

    return createSuccessResponse(dining.map(serializeDining));
  } catch (error) {
    if (error instanceof ReservationRuleError)
      return createErrorResponse(error.message, error.status);
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
  const authResult = await requireApiAuth({ permission: 'cabins:write' });
  if (!authResult.authenticated) return authResult.error;

  try {
    const json = await readJsonRequestBody(request);
    if (!json.success)
      return createErrorResponse(json.error, HTTP_STATUS.BAD_REQUEST);
    const body = json.data;

    const validationResult = createDiningSchema.safeParse(body);
    if (!validationResult.success) {
      return createValidationErrorResponse(validationResult.error);
    }

    await connectDB();

    const dining = new diningReader(validationResult.data);
    await dining.save();

    return createSuccessResponse(
      serializeDining(dining),
      'Dining item created successfully',
      HTTP_STATUS.CREATED
    );
  } catch (error: unknown) {
    if (error instanceof ReservationRuleError)
      return createErrorResponse(error.message, error.status);
    if (isMongooseValidationError(error)) {
      return createErrorResponse(
        'Validation failed',
        HTTP_STATUS.BAD_REQUEST,
        mongooseValidationDetails(error)
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
  const authResult = await requireApiAuth({ permission: 'cabins:write' });
  if (!authResult.authenticated) return authResult.error;

  try {
    const json = await readJsonRequestBody(request);
    if (!json.success)
      return createErrorResponse(json.error, HTTP_STATUS.BAD_REQUEST);
    const body = json.data;

    const validationResult = updateDiningSchema.safeParse(body);
    if (!validationResult.success) {
      return createValidationErrorResponse(validationResult.error);
    }

    await connectDB();

    const { _id, ...updateData } = validationResult.data;

    const dining = await updateCapacityCatalog({
      kind: 'dining',
      listingId: _id,
      updates: updateData,
    });

    if (!dining) {
      return createErrorResponse(
        'Dining item not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    if (!('mealType' in dining))
      throw new TypeError('Expected a dining catalog');

    return createSuccessResponse(
      serializeDining(dining),
      'Dining item updated successfully'
    );
  } catch (error: unknown) {
    if (error instanceof ReservationRuleError)
      return createErrorResponse(error.message, error.status);
    if (isMongooseValidationError(error)) {
      return createErrorResponse(
        'Validation failed',
        HTTP_STATUS.BAD_REQUEST,
        mongooseValidationDetails(error)
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
  const authResult = await requireApiAuth({ permission: 'cabins:write' });
  if (!authResult.authenticated) return authResult.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return createErrorResponse(
        'Dining item ID is required',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    if (!catalogIdSchema.safeParse(id).success)
      return createErrorResponse('Invalid catalog ID', HTTP_STATUS.BAD_REQUEST);
    await connectDB();

    const dining = await deleteCapacityCatalog({
      kind: 'dining',
      listingId: id,
    });

    if (!dining) {
      return createErrorResponse(
        'Dining item not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    return createSuccessResponse(null, 'Dining item deleted successfully');
  } catch (error) {
    if (error instanceof ReservationRuleError)
      return createErrorResponse(error.message, error.status);
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
