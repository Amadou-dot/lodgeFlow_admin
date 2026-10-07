import { experienceQuerySchema } from '@/lib/validations/catalog-query';
import { readJsonRequestBody } from '@/lib/validations/request-body';
import {
  serializeExperience,
  type ExperienceJsonSource,
} from '@lodgeflow/database/experience-json';
import type { Model, FilterQuery } from 'mongoose';
import {
  createErrorResponse,
  createSuccessResponse,
  createValidationErrorResponse,
  escapeRegex,
  HTTP_STATUS,
  requireApiAuth,
} from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import connectToDatabase from '@/lib/mongodb';
import { createExperienceSchema } from '@/lib/validations';
import { Experience } from '@lodgeflow/database/models/Experience';
import {
  isMongooseValidationError,
  mongooseValidationDetails,
} from '@/lib/mongoose-errors';
import { NextRequest } from 'next/server';

const experienceReader: Model<ExperienceJsonSource> = Experience;

export async function GET(request: NextRequest) {
  // Require authentication
  const authResult = await requireApiAuth({ permission: 'bookings:read' });
  if (!authResult.authenticated) return authResult.error;

  try {
    const { searchParams } = request.nextUrl;
    const { search, category, difficulty, sortBy, sortOrder } =
      experienceQuerySchema.parse({
        search: searchParams.get('search'),
        category: searchParams.get('category'),
        difficulty: searchParams.get('difficulty'),
        sortBy: searchParams.get('sortBy'),
        sortOrder: searchParams.get('sortOrder'),
      });

    await connectToDatabase();

    // Build query
    const query: FilterQuery<ExperienceJsonSource> = {};

    if (search) {
      const regex = { $regex: escapeRegex(search), $options: 'i' };
      query.$or = [
        { name: regex },
        { description: regex },
        { location: regex },
      ];
    }

    if (category) {
      query.category = category;
    }

    if (difficulty) {
      query.difficulty = difficulty;
    }

    // Build sort (whitelist sortable fields — sortBy is user input)
    const sort: Record<string, 1 | -1> = sortBy ? { [sortBy]: sortOrder } : {};

    const experiences = await experienceReader.find(query).sort(sort);
    return createSuccessResponse(experiences.map(serializeExperience));
  } catch (error) {
    logger.error(
      'Error fetching experiences',
      error instanceof Error ? error : undefined
    );
    return createErrorResponse(
      'Failed to fetch experiences',
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

export async function POST(request: Request) {
  // Require authentication
  const authResult = await requireApiAuth({ permission: 'cabins:write' });
  if (!authResult.authenticated) return authResult.error;

  try {
    const json = await readJsonRequestBody(request);
    if (!json.success)
      return createErrorResponse(json.error, HTTP_STATUS.BAD_REQUEST);
    const data = json.data;

    const validationResult = createExperienceSchema.safeParse(data);
    if (!validationResult.success) {
      return createValidationErrorResponse(validationResult.error);
    }

    await connectToDatabase();

    const experience = new experienceReader(validationResult.data);
    await experience.save();

    return createSuccessResponse(
      serializeExperience(experience),
      undefined,
      HTTP_STATUS.CREATED
    );
  } catch (error: unknown) {
    if (isMongooseValidationError(error)) {
      return createErrorResponse(
        'Validation failed',
        HTTP_STATUS.BAD_REQUEST,
        mongooseValidationDetails(error)
      );
    }

    logger.error(
      'Error creating experience',
      error instanceof Error ? error : undefined
    );
    return createErrorResponse(
      'Failed to create experience',
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
