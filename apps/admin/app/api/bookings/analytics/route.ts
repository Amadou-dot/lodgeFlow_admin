import {
  createErrorResponse,
  createSuccessResponse,
  HTTP_STATUS,
  requireApiAuth,
} from '@/lib/api-utils';
import connectDB from '@/lib/mongodb';
import { Booking } from '../../../../models';
import { NextRequest } from 'next/server';

type Period = '7d' | '30d' | '90d' | '1y' | 'all';

function getPeriodDays(period: Period): number | null {
  switch (period) {
    case '7d':
      return 7;
    case '30d':
      return 30;
    case '90d':
      return 90;
    case '1y':
      return 365;
    case 'all':
      return null;
  }
}

function getGroupFormat(period: Period): 'daily' | 'weekly' {
  return period === '7d' || period === '30d' ? 'daily' : 'weekly';
}

export async function GET(request: NextRequest) {
  const authResult = await requireApiAuth();
  if (!authResult.authenticated) return authResult.error;

  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') || '30d') as Period;
    const validPeriods: Period[] = ['7d', '30d', '90d', '1y', 'all'];
    if (!validPeriods.includes(period)) {
      return createErrorResponse('Invalid period', HTTP_STATUS.BAD_REQUEST);
    }

    const days = getPeriodDays(period);
    const now = new Date();
    const startDate = days
      ? new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
      : null;

    const dateFilter = startDate ? { createdAt: { $gte: startDate } } : {};

    const [
      summaryResult,
      cancelledCount,
      revenueOverTime,
      statusDist,
      popularCabins,
    ] = await Promise.all([
      // 1. Summary stats (exclude cancelled)
      Booking.aggregate([
        {
          $match: {
            ...dateFilter,
            status: { $ne: 'cancelled' },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: {
              $sum: { $cond: [{ $eq: ['$isPaid', true] }, '$totalPrice', 0] },
            },
            totalBookings: { $sum: 1 },
            avgBookingValue: { $avg: '$totalPrice' },
            avgNumGuests: { $avg: '$numGuests' },
            avgNumNights: { $avg: '$numNights' },
            breakfastCount: {
              $sum: { $cond: ['$extras.hasBreakfast', 1, 0] },
            },
            petCount: { $sum: { $cond: ['$extras.hasPets', 1, 0] } },
            parkingCount: {
              $sum: { $cond: ['$extras.hasParking', 1, 0] },
            },
            earlyCheckInCount: {
              $sum: { $cond: ['$extras.hasEarlyCheckIn', 1, 0] },
            },
            lateCheckOutCount: {
              $sum: { $cond: ['$extras.hasLateCheckOut', 1, 0] },
            },
          },
        },
      ]),

      // 2. Cancellation count
      Booking.countDocuments({
        ...dateFilter,
        status: 'cancelled',
      }),

      // 3. Revenue over time
      Booking.aggregate([
        {
          $match: {
            ...dateFilter,
            status: { $ne: 'cancelled' },
          },
        },
        {
          $group: {
            _id:
              getGroupFormat(period) === 'daily'
                ? {
                    $dateToString: {
                      format: '%Y-%m-%d',
                      date: '$createdAt',
                    },
                  }
                : {
                    $dateToString: {
                      format: '%Y-%U',
                      date: '$createdAt',
                    },
                  },
            revenue: {
              $sum: {
                $cond: [{ $eq: ['$isPaid', true] }, '$totalPrice', 0],
              },
            },
            bookings: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // 4. Status distribution
      Booking.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),

      // 5. Popular cabins
      Booking.aggregate([
        {
          $match: {
            ...dateFilter,
            status: { $ne: 'cancelled' },
          },
        },
        {
          $group: {
            _id: '$cabin',
            bookingCount: { $sum: 1 },
            revenue: { $sum: '$totalPrice' },
          },
        },
        {
          $lookup: {
            from: 'cabins',
            localField: '_id',
            foreignField: '_id',
            as: 'cabinInfo',
          },
        },
        { $unwind: '$cabinInfo' },
        {
          $project: {
            _id: 0,
            name: '$cabinInfo.name',
            bookingCount: 1,
            revenue: { $round: ['$revenue', 0] },
          },
        },
        { $sort: { bookingCount: -1 } },
        { $limit: 10 },
      ]),
    ]);

    const summary = summaryResult[0] || {
      totalRevenue: 0,
      totalBookings: 0,
      avgBookingValue: 0,
      avgNumGuests: 0,
      avgNumNights: 0,
      breakfastCount: 0,
      petCount: 0,
      parkingCount: 0,
      earlyCheckInCount: 0,
      lateCheckOutCount: 0,
    };

    const totalWithCancelled = summary.totalBookings + cancelledCount;
    const cancellationRate =
      totalWithCancelled > 0
        ? Math.round((cancelledCount / totalWithCancelled) * 1000) / 10
        : 0;

    // Fill zero-gaps for revenue over time
    const filledRevenue: { date: string; revenue: number; bookings: number }[] =
      [];

    if (getGroupFormat(period) === 'daily' && startDate) {
      const totalDays = days!;
      for (let i = totalDays - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateString = date.toISOString().split('T')[0];
        const dayData = revenueOverTime.find(
          (item: { _id: string }) => item._id === dateString
        );
        filledRevenue.push({
          date: date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          }),
          revenue: dayData?.revenue || 0,
          bookings: dayData?.bookings || 0,
        });
      }
    } else {
      // For weekly grouping, just format the data as-is
      for (const item of revenueOverTime) {
        filledRevenue.push({
          date: item._id,
          revenue: item.revenue || 0,
          bookings: item.bookings || 0,
        });
      }
    }

    const totalBookings = summary.totalBookings || 1; // Avoid division by zero

    return createSuccessResponse({
      summary: {
        totalRevenue: Math.round(summary.totalRevenue),
        totalBookings: summary.totalBookings,
        avgBookingValue: Math.round(summary.avgBookingValue || 0),
        cancellationRate,
      },
      revenueOverTime: filledRevenue,
      statusDistribution: statusDist.map(
        (item: { _id: string; count: number }) => ({
          status: item._id,
          count: item.count,
        })
      ),
      popularCabins,
      demographics: {
        avgPartySize: Math.round((summary.avgNumGuests || 0) * 10) / 10,
        avgStayLength: Math.round((summary.avgNumNights || 0) * 10) / 10,
        extras: {
          breakfast: {
            count: summary.breakfastCount,
            rate: Math.round((summary.breakfastCount / totalBookings) * 100),
          },
          pets: {
            count: summary.petCount,
            rate: Math.round((summary.petCount / totalBookings) * 100),
          },
          parking: {
            count: summary.parkingCount,
            rate: Math.round((summary.parkingCount / totalBookings) * 100),
          },
          earlyCheckIn: {
            count: summary.earlyCheckInCount,
            rate: Math.round((summary.earlyCheckInCount / totalBookings) * 100),
          },
          lateCheckOut: {
            count: summary.lateCheckOutCount,
            rate: Math.round((summary.lateCheckOutCount / totalBookings) * 100),
          },
        },
      },
    });
  } catch (error) {
    console.error('Error fetching booking analytics:', error);
    return createErrorResponse(
      'Failed to fetch booking analytics',
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
