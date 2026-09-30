import { NextRequest, NextResponse } from 'next/server';

import { connectDB, Cabin } from '@lodgeflow/database';
import type { ICabin } from '@lodgeflow/database';
import { logger } from '@lodgeflow/database/logger';
import type { FilterQuery } from 'mongoose';
import type { ApiResponse, Cabin as CabinType } from '@/types';
import { serializeCabinDetail } from '@/lib/serializers/cabin-read';
import { cabinQuerySchema } from '@/lib/validations';
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
    const validation = validateRequest(cabinQuerySchema, queryParams);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const { capacity, minPrice, maxPrice, search } = validation.data;

    // Build query — only show active cabins to guests
    const query: FilterQuery<ICabin> = { status: 'active' };

    if (capacity) {
      query.capacity = { $gte: capacity };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      query.price = {
        ...(minPrice !== undefined ? { $gte: minPrice } : {}),
        ...(maxPrice !== undefined ? { $lte: maxPrice } : {}),
      };
    }

    // Text search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { amenities: { $regex: search, $options: 'i' } },
      ];
    }

    const cabins = await Cabin.find(query).sort({ price: 1 });

    const response: ApiResponse<CabinType[]> = {
      success: true,
      data: cabins.map(serializeCabinDetail),
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Error fetching cabins', error);

    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to fetch cabins',
    };

    return NextResponse.json(response, { status: 500 });
  }
}
