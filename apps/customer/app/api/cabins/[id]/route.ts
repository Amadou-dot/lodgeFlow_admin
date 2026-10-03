import { NextRequest, NextResponse } from 'next/server';
import { connectDB, Cabin } from '@lodgeflow/database';
import { logger } from '@lodgeflow/database/logger';
import type { ApiResponse, Cabin as CabinType } from '@/types';
import { serializeCabinDetail } from '@lodgeflow/database/cabin-json';
import { cabinIdSchema } from '@/lib/validations/cabin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const input = cabinIdSchema.safeParse(id);
    if (!input.success) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Invalid cabin ID',
      };
      return NextResponse.json(response, { status: 400 });
    }

    await connectDB();
    const cabin = await Cabin.findById(input.data);

    if (!cabin || (cabin.status && cabin.status !== 'active')) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Cabin not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    const response: ApiResponse<CabinType> = {
      success: true,
      data: serializeCabinDetail(cabin),
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Error fetching cabin', error);

    const response: ApiResponse<never> = {
      success: false,
      error: 'Internal server error',
    };

    return NextResponse.json(response, { status: 500 });
  }
}
