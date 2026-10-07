import { logger } from '@lodgeflow/database/logger';
import { catalogIdSchema } from '@/lib/validations/catalog';
import {
  serializeExperience,
  type ExperienceJsonSource,
} from '@lodgeflow/database/experience-json';
import type { Model } from 'mongoose';
import { connectDB, Experience } from '@lodgeflow/database';
import type { ApiResponse, Experience as ExperienceType } from '@/types';
import { NextRequest, NextResponse } from 'next/server';

const experienceReader: Model<ExperienceJsonSource> = Experience;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!catalogIdSchema.safeParse(id).success)
      return NextResponse.json(
        { success: false, error: 'Experience not found' },
        { status: 404 }
      );

    await connectDB();
    const experience = await experienceReader.findById(id).lean();

    if (!experience) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Experience not found',
      };

      return NextResponse.json(response, { status: 404 });
    }

    // Convert MongoDB document to plain object
    const serializedExperience = serializeExperience(experience);

    const response: ApiResponse<ExperienceType> = {
      success: true,
      data: serializedExperience,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error(
      'Error fetching experience',
      error instanceof Error ? error : undefined
    );

    const response: ApiResponse<never> = {
      success: false,
      error: 'Internal server error',
    };

    return NextResponse.json(response, { status: 500 });
  }
}
