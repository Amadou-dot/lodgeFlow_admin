import { connectDB, Dining } from '@/models';
import type { ApiResponse, Dining as DiningType } from '@/types';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await connectDB();
    const dining = await Dining.findById(id).lean();

    if (!dining) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Dining item not found',
      };

      return NextResponse.json(response, { status: 404 });
    }

    // Convert MongoDB document to plain object
    const serializedDining = JSON.parse(JSON.stringify(dining));

    const response: ApiResponse<DiningType> = {
      success: true,
      data: serializedDining,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching dining item:', error);

    const response: ApiResponse<never> = {
      success: false,
      error: 'Internal server error',
    };

    return NextResponse.json(response, { status: 500 });
  }
}
