import { requireApiAuth } from '@/lib/api-utils';
import { getClerkUsersBatch } from '@/lib/clerk-users';
import connectDB from '@/lib/mongodb';
import type {
  DurationDataItem,
  OccupancyDataItem,
  RecentBookingPopulated,
  RevenueDataItem,
} from '@/types/api';
import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { Booking, Cabin } from '../../../models';

export async function GET() {
  // Require authentication
  const authResult = await requireApiAuth();
  if (!authResult.authenticated) return authResult.error;

  try {
    await connectDB();

    // Get current date and calculate periods
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    // const sixMonthsAgo = new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000);

    // Parallel queries for efficiency - all queries run at once
    const [
      totalBookings,
      totalRevenue,
      totalCabins,
      totalCustomers,
      totalCancellations,
      recentBookings,
      checkInsToday,
      checkOutsToday,
      occupancyData,
      revenueData,
      durationData,
      totalCapacity,
      currentOccupancy,
    ] = await Promise.all([
      // Total bookings in last 30 days
      Booking.countDocuments({
        createdAt: { $gte: thirtyDaysAgo },
        status: { $ne: 'cancelled' },
      }),

      // Total revenue in last 30 days
      Booking.aggregate([
        {
          $match: {
            createdAt: { $gte: thirtyDaysAgo },
            status: { $ne: 'cancelled' },
            isPaid: true,
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalPrice' },
          },
        },
      ]),

      // Total cabins
      Cabin.countDocuments(),

      // Total customers from Clerk
      (async () => {
        const clerk = await clerkClient();
        return clerk.users.getCount();
      })(),

      // Total cancellations in last 30 days
      Booking.countDocuments({
        createdAt: { $gte: thirtyDaysAgo },
        status: 'cancelled',
      }),

      // Recent bookings (last 7 days)
      Booking.find({
        createdAt: { $gte: sevenDaysAgo },
      })
        .populate('cabin', 'name')
        .sort({ createdAt: -1 })
        .limit(10),

      // Check-ins today
      Booking.countDocuments({
        checkInDate: {
          $gte: new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate()
          ),
          $lt: new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate() + 1
          ),
        },
        status: 'confirmed',
      }),

      // Check-outs today
      Booking.countDocuments({
        checkOutDate: {
          $gte: new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate()
          ),
          $lt: new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate() + 1
          ),
        },
        status: 'checked-in',
      }),

      // Occupancy data for last 7 days
      Booking.aggregate([
        {
          $match: {
            checkInDate: { $lte: today },
            checkOutDate: { $gt: sevenDaysAgo },
            status: { $in: ['confirmed', 'checked-in', 'checked-out'] },
          },
        },
        {
          $lookup: {
            from: 'cabins',
            localField: 'cabin',
            foreignField: '_id',
            as: 'cabinData',
          },
        },
        {
          $unwind: '$cabinData',
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$checkInDate',
              },
            },
            totalGuests: { $sum: '$numGuests' },
            totalCapacity: { $sum: '$cabinData.capacity' },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]),

      // Revenue data for last 30 days by week
      Booking.aggregate([
        {
          $match: {
            createdAt: { $gte: thirtyDaysAgo },
            status: { $ne: 'cancelled' },
            isPaid: true,
          },
        },
        {
          $group: {
            _id: {
              week: { $week: '$createdAt' },
              year: { $year: '$createdAt' },
            },
            totalRevenue: { $sum: '$totalPrice' },
            bookingCount: { $sum: 1 },
          },
        },
        {
          $sort: { '_id.year': 1, '_id.week': 1 },
        },
      ]),

      // Duration distribution data
      Booking.aggregate([
        {
          $match: {
            createdAt: { $gte: thirtyDaysAgo },
            status: { $ne: 'cancelled' },
          },
        },
        {
          $group: {
            _id: {
              $switch: {
                branches: [
                  {
                    case: { $lte: ['$numNights', 2] },
                    then: '1-2 nights',
                  },
                  {
                    case: { $lte: ['$numNights', 4] },
                    then: '3-4 nights',
                  },
                  {
                    case: { $lte: ['$numNights', 7] },
                    then: '5-7 nights',
                  },
                  {
                    case: { $lte: ['$numNights', 14] },
                    then: '8-14 nights',
                  },
                ],
                default: '15+ nights',
              },
            },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]),

      // Total cabin capacity
      Cabin.aggregate([
        {
          $group: {
            _id: null,
            totalCapacity: { $sum: '$capacity' },
          },
        },
      ]),

      // Current occupancy
      Booking.aggregate([
        {
          $match: {
            checkInDate: { $lte: today },
            checkOutDate: { $gt: today },
            status: { $in: ['confirmed', 'checked-in'] },
          },
        },
        {
          $group: {
            _id: null,
            occupiedCapacity: { $sum: '$numGuests' },
          },
        },
      ]),
    ]);

    // Calculate occupancy rate from parallel results
    const occupancyRate =
      totalCapacity[0] && currentOccupancy[0]
        ? (currentOccupancy[0].occupiedCapacity /
            totalCapacity[0].totalCapacity) *
          100
        : 0;

    // Format the response
    const stats = {
      overview: {
        totalBookings,
        totalRevenue: totalRevenue[0]?.total || 0,
        totalCabins,
        totalCustomers,
        totalCancellations,
        occupancyRate: Math.round(occupancyRate * 100) / 100,
        checkInsToday,
        checkOutsToday,
      },
      recentActivity: await (async () => {
        // Batch fetch all customer names at once
        const bookingsList =
          recentBookings as unknown as RecentBookingPopulated[];
        const customerIds = bookingsList
          .map(b => b.customer)
          .filter((id): id is string => !!id);
        const { users: customerMap } = await getClerkUsersBatch(customerIds);

        return bookingsList.map(booking => {
          let customerName = 'Customer';

          if (booking.customer) {
            const clerkUser = customerMap.get(booking.customer);
            if (clerkUser) {
              customerName =
                clerkUser.name ||
                `${clerkUser.first_name || ''} ${clerkUser.last_name || ''}`.trim() ||
                'Customer';
            }
          }

          return {
            id: booking._id,
            customerName,
            cabinName: booking.cabin?.name || 'Unknown',
            checkInDate: booking.checkInDate,
            checkOutDate: booking.checkOutDate,
            totalPrice: booking.totalPrice,
            status: booking.status,
            createdAt: booking.createdAt,
          };
        });
      })(),
      charts: {
        occupancy: (occupancyData as OccupancyDataItem[]).map(item => ({
          date: item._id,
          occupancyRate:
            item.totalCapacity > 0
              ? Math.round((item.totalGuests / item.totalCapacity) * 100)
              : 0,
          totalGuests: item.totalGuests,
          totalCapacity: item.totalCapacity,
        })),
        revenue: (revenueData as RevenueDataItem[]).map(item => ({
          week: `Week ${item._id.week}`,
          revenue: item.totalRevenue,
          bookings: item.bookingCount,
        })),
        durations: (() => {
          const colors = [
            '#3b82f6', // blue
            '#10b981', // emerald
            '#f59e0b', // amber
            '#ef4444', // red
            '#8b5cf6', // violet
          ];

          const categories = [
            '1-2 nights',
            '3-4 nights',
            '5-7 nights',
            '8-14 nights',
            '15+ nights',
          ];

          return categories
            .map((category, index) => {
              const found = (durationData as DurationDataItem[]).find(
                item => item._id === category
              );
              return {
                name: category,
                value: found ? found.count : 0,
                color: colors[index],
              };
            })
            .filter(item => item.value > 0);
        })(),
      },
    };

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching dashboard statistics:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch dashboard statistics',
      },
      { status: 500 }
    );
  }
}
