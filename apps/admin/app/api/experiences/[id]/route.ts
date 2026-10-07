import { readJsonRequestBody } from '@/lib/validations/request-body';
import {
  catalogIdSchema,
  withCatalogPathId,
} from '@/lib/validations/catalog-request';
import {
  serializeExperience,
  type ExperienceJsonSource,
} from '@lodgeflow/database/experience-json';
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
import connectToDatabase from '@/lib/mongodb';
import { updateExperienceSchema } from '@/lib/validations';
import { Experience } from '@lodgeflow/database/models/Experience';
import {
  isMongooseValidationError,
  mongooseValidationDetails,
} from '@/lib/mongoose-errors';

type ParamProps = {
  params: Promise<{ id: string }>;
};

const experienceReader: Model<ExperienceJsonSource> = Experience;

export async function GET(_request: Request, { params }: ParamProps) {
  // Require authentication
  const authResult = await requireApiAuth({ permission: 'bookings:read' });
  if (!authResult.authenticated) return authResult.error;

  const { id } = await params;
  try {
    if (!catalogIdSchema.safeParse(id).success)
      return createErrorResponse('Invalid catalog ID', HTTP_STATUS.BAD_REQUEST);
    await connectToDatabase();
    const experience = await experienceReader.findById(id);
    if (!experience) {
      return createErrorResponse('Experience not found', HTTP_STATUS.NOT_FOUND);
    }

    return createSuccessResponse(serializeExperience(experience));
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
  const authResult = await requireApiAuth({ permission: 'cabins:write' });
  if (!authResult.authenticated) return authResult.error;

  const { id } = await params;
  try {
    const json = await readJsonRequestBody(request);
    if (!json.success)
      return createErrorResponse(json.error, HTTP_STATUS.BAD_REQUEST);
    const data = json.data;

    const validationResult = updateExperienceSchema.safeParse(
      withCatalogPathId({ body: data, id })
    );
    if (!validationResult.success) {
      return createValidationErrorResponse(validationResult.error);
    }

    await connectToDatabase();

    const { _id: _validatedId, ...updateData } = validationResult.data;

    const experience = await updateCapacityCatalog({
      kind: 'experience',
      listingId: id,
      updates: updateData,
    });
    if (!experience) {
      return createErrorResponse('Experience not found', HTTP_STATUS.NOT_FOUND);
    }

    if (!('difficulty' in experience))
      throw new TypeError('Expected an experience catalog');
    return createSuccessResponse(serializeExperience(experience));
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
  const authResult = await requireApiAuth({ permission: 'cabins:write' });
  if (!authResult.authenticated) return authResult.error;

  const { id } = await params;
  try {
    if (!catalogIdSchema.safeParse(id).success)
      return createErrorResponse('Invalid catalog ID', HTTP_STATUS.BAD_REQUEST);
    await connectToDatabase();
    const experience = await deleteCapacityCatalog({
      kind: 'experience',
      listingId: id,
    });
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
