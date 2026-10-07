import { logger } from '@lodgeflow/database/logger';
import { catalogIdSchema } from '@/lib/validations/catalog';
import {
  serializeDining,
  type DiningJsonSource,
} from '@lodgeflow/database/dining-json';
import type { Model } from 'mongoose';
import { connectDB, Dining } from '@lodgeflow/database';
import type { ApiResponse, Dining as DiningType } from '@/types';
import { NextRequest, NextResponse } from 'next/server';

const diningReader: Model<DiningJsonSource> = Dining;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!catalogIdSchema.safeParse(id).success)
      return NextResponse.json(
        { success: false, error: 'Dining item not found' },
        { status: 404 }
      );

    await connectDB();
    const dining = await diningReader.findById(id).lean();

    if (!dining) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Dining item not found',
      };

      return NextResponse.json(response, { status: 404 });
    }

    // Convert MongoDB document to plain object
    const serializedDining = serializeDining(dining);

    const response: ApiResponse<DiningType> = {
      success: true,
      data: serializedDining,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error(
      'Error fetching dining item',
      error instanceof Error ? error : undefined
    );

    const response: ApiResponse<never> = {
      success: false,
      error: 'Internal server error',
    };

    return NextResponse.json(response, { status: 500 });
  }
}
