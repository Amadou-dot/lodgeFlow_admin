import { NextRequest, NextResponse } from 'next/server';
import { connectDB, Cabin } from '@/models';
import type { ApiResponse, Cabin as CabinType } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await connectDB();
    const cabin = await Cabin.findById(id);

    if (!cabin || (cabin.status && cabin.status !== 'active')) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Cabin not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    const response: ApiResponse<CabinType> = {
      success: true,
      data: cabin,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching cabin:', error);

    const response: ApiResponse<never> = {
      success: false,
      error: 'Internal server error',
    };

    return NextResponse.json(response, { status: 500 });
  }
}
