import { escapeRegex, requireApiAuth } from '@/lib/api-utils';
import connectToDatabase from '@/lib/mongodb';
import { Experience } from '@/models/Experience';
import { NextRequest, NextResponse } from 'next/server';

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
    return NextResponse.json({
      success: true,
      data: experiences,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch experiences' },
      { status: 500 }
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
    const experience = new Experience(data);
    await experience.save();
    return NextResponse.json(
      { success: true, data: experience },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to create experience' },
      { status: 500 }
    );
  }
}
