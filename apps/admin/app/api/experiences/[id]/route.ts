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
import connectToDatabase from '@/lib/mongodb';
import { updateExperienceSchema } from '@/lib/validations';
import { Experience } from '@lodgeflow/database/models/Experience';
import { isMongooseValidationError } from '@/types/errors';

type ParamProps = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: ParamProps) {
  // Require authentication
  const authResult = await requireApiAuth();
  if (!authResult.authenticated) return authResult.error;

  const { id } = await params;
  try {
    await connectToDatabase();
    const experience = await Experience.findById(id);
    if (!experience) {
      return createErrorResponse('Experience not found', HTTP_STATUS.NOT_FOUND);
    }

    return createSuccessResponse(experience);
  } catch (error) {
    if (error instanceof ReservationRuleError)
      return createErrorResponse(error.message, error.status);
    logger.error(
      'Error fetching experience',
      error instanceof Error ? error : undefined
    );
    return createErrorResponse(
      'Failed to fetch experience',
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

export async function PUT(request: Request, { params }: ParamProps) {
  // Require authentication
  const authResult = await requireApiAuth();
  if (!authResult.authenticated) return authResult.error;

  const { id } = await params;
  try {
    await connectToDatabase();
    const data = await request.json();

    const validationResult = updateExperienceSchema.safeParse({
      ...data,
      _id: id,
    });
    if (!validationResult.success) {
      return createValidationErrorResponse(validationResult.error);
    }

    const { _id: _validatedId, ...updateData } = validationResult.data;

    const experience = await updateCapacityCatalog(
      'experience',
      id,
      updateData
    );
    if (!experience) {
      return createErrorResponse('Experience not found', HTTP_STATUS.NOT_FOUND);
    }

    return createSuccessResponse(experience);
  } catch (error: unknown) {
    if (error instanceof ReservationRuleError)
      return createErrorResponse(error.message, error.status);
    if (isMongooseValidationError(error)) {
      return createErrorResponse(
        'Validation failed',
        HTTP_STATUS.BAD_REQUEST,
        error.errors
      );
    }

    logger.error(
      'Error updating experience',
      error instanceof Error ? error : undefined
    );
    return createErrorResponse(
      'Failed to update experience',
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

export async function DELETE(_request: Request, { params }: ParamProps) {
  // Require authentication
  const authResult = await requireApiAuth();
  if (!authResult.authenticated) return authResult.error;

  const { id } = await params;
  try {
    await connectToDatabase();
    const experience = await deleteCapacityCatalog('experience', id);
    if (!experience) {
      return createErrorResponse('Experience not found', HTTP_STATUS.NOT_FOUND);
    }

    return createSuccessResponse(null, 'Experience deleted successfully');
  } catch (error) {
    if (error instanceof ReservationRuleError)
      return createErrorResponse(error.message, error.status);
    logger.error(
      'Error deleting experience',
      error instanceof Error ? error : undefined
    );
    return createErrorResponse(
      'Failed to delete experience',
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
