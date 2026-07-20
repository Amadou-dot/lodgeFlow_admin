import {
  createErrorResponse,
  createSuccessResponse,
  createValidationErrorResponse,
  HTTP_STATUS,
  requireApiAuth,
} from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import { updateDiningSchema } from '@/lib/validations';
import { connectDB, Dining } from '@/models';
import { isMongooseValidationError } from '@/types/errors';
import { NextRequest } from 'next/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Require authentication
  const authResult = await requireApiAuth();
  if (!authResult.authenticated) return authResult.error;

  try {
    await connectDB();

    const { id } = await params;
    const dining = await Dining.findById(id);

    if (!dining) {
      return createErrorResponse(
        'Dining item not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    return createSuccessResponse(dining);
  } catch (error) {
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
  const authResult = await requireApiAuth();
  if (!authResult.authenticated) return authResult.error;

  try {
    await connectDB();

    const body = await request.json();
    const { id } = await params;

    const validationResult = updateDiningSchema.safeParse({ ...body, _id: id });
    if (!validationResult.success) {
      return createValidationErrorResponse(validationResult.error);
    }

    const { _id: _validatedId, ...updateData } = validationResult.data;

    const dining = await Dining.findByIdAndUpdate(id, updateData, {
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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Require authentication
  const authResult = await requireApiAuth();
  if (!authResult.authenticated) return authResult.error;

  try {
    await connectDB();

    const { id } = await params;
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
