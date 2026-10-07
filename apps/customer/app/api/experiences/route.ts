import {
  serializeExperience,
  type ExperienceJsonSource,
} from '@lodgeflow/database/experience-json';
import type { Model } from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import { connectDB, Experience, type IExperience } from '@lodgeflow/database';
import type { FilterQuery } from 'mongoose';
import type { ApiResponse, Experience as ExperienceType } from '@/types';
import { logger } from '@lodgeflow/database/logger';
import { experienceQuerySchema } from '@/lib/validations';
import {
  validateRequest,
  validationErrorResponse,
} from '@/lib/validations/utils';

const experienceReader: Model<ExperienceJsonSource> = Experience;

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);

    // Convert searchParams to object for validation
    const queryParams = Object.fromEntries(searchParams.entries());

    // Validate query parameters with Zod
    const validation = validateRequest(experienceQuerySchema, queryParams);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const { category, difficulty, minPrice, maxPrice, isPopular, tags } =
      validation.data;

    // Build query
    const query: FilterQuery<IExperience> = {};

    if (category) {
      query.category = category;
    }

    if (difficulty) {
      query.difficulty = difficulty;
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      query.price = {
        ...(minPrice === undefined ? {} : { $gte: minPrice }),
        ...(maxPrice === undefined ? {} : { $lte: maxPrice }),
      };
    }

    if (isPopular !== undefined) {
      query.isPopular = isPopular;
    }

    if (tags) {
      const tagArray = tags.split(',');
      query.tags = { $in: tagArray };
    }

    const experiences = await experienceReader.find(query).sort({
      isPopular: -1,
      price: 1,
    });

    const response: ApiResponse<ExperienceType[]> = {
      success: true,
      data: experiences.map(serializeExperience),
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    logger.error(
      'Error fetching experiences',
      error instanceof Error ? error : undefined
    );

    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to fetch experiences',
    };

    return NextResponse.json(response, { status: 500 });
  }
}
