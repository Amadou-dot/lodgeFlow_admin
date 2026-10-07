import { readJsonRequestBody } from '@/lib/validations/request-body';
import {
  catalogIdSchema,
  withCatalogPathId,
} from '@/lib/validations/catalog-request';
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
  HTTP_STATUS,
  requireApiAuth,
} from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import { updateDiningSchema } from '@/lib/validations';
import { connectDB, Dining } from '@lodgeflow/database';
import {
  isMongooseValidationError,
  mongooseValidationDetails,
} from '@/lib/mongoose-errors';
import { NextRequest } from 'next/server';

const diningReader: Model<DiningJsonSource> = Dining;

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
    const dining = await diningReader.findById(id);

    if (!dining) {
      return createErrorResponse(
        'Dining item not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    return createSuccessResponse(serializeDining(dining));
  } catch (error) {
    if (error instanceof ReservationRuleError)
      return createErrorResponse(error.message, error.status);
    logger.error(
      'Error fetching dining item',
      error instanceof Error ? error : undefined
    );
    return createErrorResponse(
      'Failed to fetch dining item',
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
    const json = await readJsonRequestBody(request);
    if (!json.success)
      return createErrorResponse(json.error, HTTP_STATUS.BAD_REQUEST);
    const body = json.data;
    const { id } = await params;

    const validationResult = updateDiningSchema.safeParse(
      withCatalogPathId({ body, id })
    );
    if (!validationResult.success) {
      return createValidationErrorResponse(validationResult.error);
    }

    await connectDB();

    const { _id: _validatedId, ...updateData } = validationResult.data;

    const dining = await updateCapacityCatalog({
      kind: 'dining',
      listingId: id,
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
