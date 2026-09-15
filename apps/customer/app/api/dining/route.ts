import { NextResponse } from 'next/server';

import { connectDB, Dining } from '@/models';
import { diningQuerySchema } from '@/lib/validations';
import {
  validateRequest,
  validationErrorResponse,
} from '@/lib/validations/utils';

export async function GET(request: Request) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);

    // Convert searchParams to object for validation
    const queryParams = Object.fromEntries(searchParams.entries());

    // Validate query parameters with Zod
    const validation = validateRequest(diningQuerySchema, queryParams);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const {
      type,
      mealType,
      category,
      minPrice,
      maxPrice,
      isPopular,
      dietary,
      search,
    } = validation.data;

    // Build query object based on validated parameters
    const query: any = { isAvailable: true };

    if (type) {
      query.type = type;
    }

    if (mealType) {
      query.mealType = mealType;
    }

    if (category) {
      query.category = category;
    }

    if (isPopular !== undefined) {
      query.isPopular = isPopular;
    }

    // Price range filtering
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = minPrice;
      if (maxPrice) query.price.$lte = maxPrice;
    }

    // Dietary restrictions filtering
    if (dietary) {
      const dietaryArray = dietary.split(',');
      query.dietary = { $in: dietaryArray };
    }

    // Text search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { dietary: { $regex: search, $options: 'i' } },
      ];
    }

    const dining = await Dining.find(query).sort({
      mealType: 1,
      type: 1,
      name: 1,
    });

    return NextResponse.json({
      success: true,
      data: dining,
    });
  } catch (error) {
    console.error('Error fetching dining options:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch dining options',
      },
      { status: 500 }
    );
  }
}
