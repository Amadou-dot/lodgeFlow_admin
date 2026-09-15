import { NextRequest, NextResponse } from 'next/server';

import { connectDB, Experience } from '@/models';
import type { ApiResponse, Experience as ExperienceType } from '@/types';
import { experienceQuerySchema } from '@/lib/validations';
import {
  validateRequest,
  validationErrorResponse,
} from '@/lib/validations/utils';

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
    const query: any = {};

    if (category) {
      query.category = category;
    }

    if (difficulty) {
      query.difficulty = difficulty;
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = minPrice;
      if (maxPrice) query.price.$lte = maxPrice;
    }

    if (isPopular !== undefined) {
      query.isPopular = isPopular;
    }

    if (tags) {
      const tagArray = tags.split(',');
      query.tags = { $in: tagArray };
    }

    const experiences = await Experience.find(query).sort({
      isPopular: -1,
      price: 1,
    });

    const response: ApiResponse<ExperienceType[]> = {
      success: true,
      data: experiences,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching experiences:', error);

    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to fetch experiences',
    };

    return NextResponse.json(response, { status: 500 });
  }
}
