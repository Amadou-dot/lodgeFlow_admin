import { logger } from '@/lib/logger';
import { readJsonRequestBody } from '@/lib/validations/request-body';
import { CustomerProviderError } from '@/lib/customer-errors';
import { serializeCustomer } from '@/lib/serializers/customer';
import {
  createRateLimitResponse,
  createErrorResponse,
  createValidationErrorResponse,
  parsePagination,
  requireApiAuth,
} from '@/lib/api-utils';
import {
  createCompleteCustomer,
  getClerkUsers,
  searchClerkUsers,
} from '@/lib/clerk-users';
import connectDB from '@/lib/mongodb';
import {
  checkRateLimit,
  createRateLimitKey,
  RATE_LIMIT_CONFIGS,
} from '@/lib/rate-limit';
import { createCustomerSchema } from '@/lib/validations';
import { Booking } from '@lodgeflow/database';
import { Customer } from '@/types/clerk';
import { getLoyaltyTier } from '@/utils/utilityFunctions';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Require authentication
  const authResult = await requireApiAuth({ permission: 'bookings:read' });
  if (!authResult.authenticated) return authResult.error;

  try {
    const { searchParams } = new URL(request.url);
    const { page, limit, skip: offset } = parsePagination(searchParams);
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Map sortBy to valid Clerk fields
    let clerkSortBy = 'created_at';
    switch (sortBy) {
      case 'name':
        clerkSortBy = 'first_name';
        break;
      case 'email':
        clerkSortBy = 'email_address';
        break;
      case 'created_at':
      case 'updated_at':
      case 'last_sign_in_at':
      case 'last_active_at':
        clerkSortBy = sortBy;
        break;
      default:
        clerkSortBy = 'created_at';
    }

    const orderBy = `${sortOrder === 'desc' ? '-' : ''}${clerkSortBy}`;

    let response;
    if (search) {
      response = await searchClerkUsers({ query: search, limit, offset });
    } else {
      response = await getClerkUsers({
        limit,
        offset,
        orderBy,
      });
    }

    const totalCustomers = response.totalCount;
    const totalPages = Math.ceil(totalCustomers / limit);

    // Enrich customers with real booking stats from MongoDB
    await connectDB();

    const userIds = response.data.map((customer: Customer) => customer.id);

    const statsResults = await Booking.aggregate<{
      _id: string;
      totalBookings: number;
      totalSpent: number;
    }>([
      { $match: { customer: { $in: userIds } } },
      {
        $group: {
          _id: '$customer',
          totalBookings: { $sum: 1 },
          totalSpent: {
            $sum: {
              $cond: [{ $eq: ['$isPaid', true] }, '$totalPrice', 0],
            },
          },
        },
      },
    ]);

    const statsMap = new Map(
      statsResults.map(stat => [
        stat._id,
        {
          totalBookings: stat.totalBookings,
          totalSpent: stat.totalSpent,
        },
      ])
    );

    const enrichedData = response.data.map((customer: Customer) => {
      const stats = statsMap.get(customer.id) ?? {
        totalBookings: 0,
        totalSpent: 0,
      };
      return serializeCustomer({
        ...customer,
        totalBookings: stats.totalBookings,
        totalSpent: stats.totalSpent,
        loyaltyTier: getLoyaltyTier(stats.totalSpent).tier,
      });
    });

    return NextResponse.json({
      success: true,
      data: enrichedData,
      pagination: {
        currentPage: page,
        totalPages,
        totalCustomers,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    logger.error('Failed to fetch customers', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch customers',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Require authentication
  const authResult = await requireApiAuth({ permission: 'bookings:manage' });
  if (!authResult.authenticated) return authResult.error;

  // Rate limit customer creation
  const rateLimitKey = createRateLimitKey({
    userId: authResult.userId,
    endpoint: 'customer-create',
  });
  const rateLimitResult = await checkRateLimit(
    rateLimitKey,
    RATE_LIMIT_CONFIGS.CUSTOMER_CREATE
  );
  if (!rateLimitResult.success) {
    return createRateLimitResponse(rateLimitResult.resetTime);
  }

  try {
    const body = await readJsonRequestBody(request);
    if (!body.success) return createErrorResponse(body.error, 400);

    // Validate request body with Zod
    const validationResult = createCustomerSchema.safeParse(body.data);
    if (!validationResult.success) {
      return createValidationErrorResponse(validationResult.error);
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      password,
      nationality,
      nationalId,
      address,
      emergencyContact,
      preferences,
    } = validationResult.data;

    // Create complete customer (Clerk user + extended data)
    const customer = await createCompleteCustomer({
      email,
      phone,
      password,
      firstName,
      lastName,
      nationality,
      nationalId,
      address,
      emergencyContact,
      preferences,
    });

    return NextResponse.json({
      success: true,
      data: serializeCustomer(customer),
      message: 'Customer created successfully',
    });
  } catch (error: unknown) {
    if (error instanceof CustomerProviderError && error.kind === 'conflict')
      return createErrorResponse(error.message, 409);
    logger.error('Failed to create customer', error);
    return createErrorResponse('Failed to create customer', 500);
  }
}
