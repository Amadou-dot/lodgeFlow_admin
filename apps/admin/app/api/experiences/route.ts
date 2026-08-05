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
import { Experience } from '@/models/Experience';
import { isMongooseValidationError } from '@/types/errors';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  // Require authentication
  const authResult = await requireApiAuth();
  if (!authResult.authenticated) return authResult.error;

  try {
    await connectToDatabase();

    const { searchParams } = request.nextUrl;
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const difficulty = searchParams.get('difficulty');
    const sortBy = searchParams.get('sortBy');
    const sortOrder = searchParams.get('sortOrder') === 'desc' ? -1 : 1;

    // Build query
    const query: Record<string, unknown> = {};

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
    const SORTABLE_FIELDS = new Set([
      'name',
      'price',
      'duration',
      'difficulty',
      'category',
      'isPopular',
      'createdAt',
    ]);
    const sort: Record<string, 1 | -1> = {};
    if (sortBy && SORTABLE_FIELDS.has(sortBy)) {
      sort[sortBy] = sortOrder;
    }

    const experiences = await Experience.find(query).sort(sort);
    return createSuccessResponse(experiences);
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
  const authResult = await requireApiAuth();
  if (!authResult.authenticated) return authResult.error;

  try {
    await connectToDatabase();
    const data = await request.json();

    const validationResult = createExperienceSchema.safeParse(data);
    if (!validationResult.success) {
      return createValidationErrorResponse(validationResult.error);
    }

    const experience = new Experience(validationResult.data);
    await experience.save();

    return createSuccessResponse(experience, undefined, HTTP_STATUS.CREATED);
  } catch (error: unknown) {
    if (isMongooseValidationError(error)) {
      return createErrorResponse(
        'Validation failed',
        HTTP_STATUS.BAD_REQUEST,
        error.errors
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
