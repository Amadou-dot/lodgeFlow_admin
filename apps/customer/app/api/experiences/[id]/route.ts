import { connectDB, Experience } from '@/models';
import type { ApiResponse, Experience as ExperienceType } from '@/types';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await connectDB();
    const experience = await Experience.findById(id).lean();

    if (!experience) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Experience not found',
      };

      return NextResponse.json(response, { status: 404 });
    }

    // Convert MongoDB document to plain object
    const serializedExperience = JSON.parse(JSON.stringify(experience));

    const response: ApiResponse<ExperienceType> = {
      success: true,
      data: serializedExperience,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching experience:', error);

    const response: ApiResponse<never> = {
      success: false,
      error: 'Internal server error',
    };

    return NextResponse.json(response, { status: 500 });
  }
}
