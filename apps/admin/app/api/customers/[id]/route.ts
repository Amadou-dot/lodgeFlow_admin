import { logger } from '@/lib/logger';
import { readJsonRequestBody } from '@/lib/validations/request-body';
import { updateCustomerSchema } from '@/lib/validations/customer';
import { serializeCustomer } from '@/lib/serializers/customer';
import {
  serializeRecentCustomerBooking,
  type AdminBookingCabinSource,
} from '@/lib/serializers/booking';
import {
  requireApiAuth,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/api-utils';
import {
  deleteCompleteCustomer,
  getClerkUser,
  updateCompleteCustomer,
} from '@/lib/clerk-users';
import connectDB from '@/lib/mongodb';
import { Booking } from '@lodgeflow/database';
import { getLoyaltyTier } from '@/utils/utilityFunctions';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Require authentication
  const authResult = await requireApiAuth({ permission: 'bookings:read' });
  if (!authResult.authenticated) return authResult.error;

  try {
    const { id } = await params;

    // Get customer from Clerk with metadata
    const customer = await getClerkUser(id);

    if (!customer) {
      return NextResponse.json(
        {
          success: false,
          error: 'Customer not found',
        },
        { status: 404 }
      );
    }

    // Compute stats on demand from Booking collection
    await connectDB();

    const [statsResult, recentBookings] = await Promise.all([
      Booking.aggregate<{
        totalBookings: number;
        completedBookings: number;
        totalRevenue: number;
        averageStayLength: number;
        lastBookingDate: Date;
      }>([
        { $match: { customer: id } },
        {
          $group: {
            _id: null,
            totalBookings: { $sum: 1 },
            completedBookings: {
              $sum: { $cond: [{ $eq: ['$status', 'checked-out'] }, 1, 0] },
            },
            totalRevenue: {
              $sum: {
                $cond: [{ $eq: ['$isPaid', true] }, '$totalPrice', 0],
              },
            },
            totalNights: { $sum: '$numNights' },
            lastBookingDate: { $max: '$createdAt' },
          },
        },
        {
          $project: {
            _id: 0,
            totalBookings: 1,
            completedBookings: 1,
            totalRevenue: 1,
            lastBookingDate: 1,
            averageStayLength: {
              $cond: [
                { $gt: ['$totalBookings', 0] },
                { $divide: ['$totalNights', '$totalBookings'] },
                0,
              ],
            },
          },
        },
      ]),
      Booking.find({ customer: id })
        .populate<{ cabin: AdminBookingCabinSource | null }>(
          'cabin',
          'name image capacity price'
        )
        .sort({ createdAt: -1 })
        .limit(10),
    ]);

    const stats = statsResult[0] || {
      totalBookings: 0,
      completedBookings: 0,
      totalRevenue: 0,
      averageStayLength: 0,
      lastBookingDate: undefined,
    };

    const customerData = {
      ...serializeCustomer(customer),
      // Override computed fields with actual booking stats
      totalBookings: stats.totalBookings,
      totalSpent: stats.totalRevenue,
      lastBookingDate: stats.lastBookingDate?.toISOString(),
      loyaltyTier: getLoyaltyTier(stats.totalRevenue).tier,
      // Additional calculated stats for display
      completedBookings: stats.completedBookings,
      totalRevenue: stats.totalRevenue,
      averageStayLength: stats.averageStayLength,
      recentBookings: recentBookings.map(serializeRecentCustomerBooking),
    };

    return NextResponse.json({
      success: true,
      data: customerData,
    });
  } catch (error) {
    logger.error('Failed to fetch customer', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch customer' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Require authentication
  const authResult = await requireApiAuth({ permission: 'bookings:manage' });
  if (!authResult.authenticated) return authResult.error;

  try {
    const { id } = await params;

    const body = await readJsonRequestBody(request);
    if (!body.success) return createErrorResponse(body.error, 400);
    const parsed = updateCustomerSchema.safeParse(body.data);
    if (!parsed.success) return createValidationErrorResponse(parsed.error);
    const customer = await updateCompleteCustomer(id, parsed.data);

    return NextResponse.json({
      success: true,
      data: serializeCustomer(customer),
    });
  } catch (error: unknown) {
    logger.error('Failed to update customer', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update customer',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Require authentication
  const authResult = await requireApiAuth();
  if (!authResult.authenticated) return authResult.error;

  try {
    await connectDB();
    const { id } = await params;

    // Check if customer has any bookings
    const bookingCount = await Booking.countDocuments({ customer: id });

    if (bookingCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot delete customer with existing bookings',
        },
        { status: 400 }
      );
    }

    // Delete customer from Clerk (no more MongoDB cleanup needed)
    await deleteCompleteCustomer(id);

    return NextResponse.json({
      success: true,
      message: 'Customer deleted successfully',
    });
  } catch (error) {
    logger.error('Failed to delete customer', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete customer',
      },
      { status: 500 }
    );
  }
}
