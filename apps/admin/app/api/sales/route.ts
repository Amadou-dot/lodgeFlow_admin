import { requireApiAuth } from '@/lib/api-utils';
import connectDB from '@/lib/mongodb';
import { NextResponse } from 'next/server';
import { Booking } from '../../../models';

export interface SalesData {
  date: string;
  fullDate: string;
  sales: number;
  bookings: number;
}

export async function GET() {
  // Require authentication
  const authResult = await requireApiAuth();
  if (!authResult.authenticated) return authResult.error;

  try {
    await connectDB();

    // Get current date and calculate periods
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Aggregate sales data by day for the last 30 days
    const salesData = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
          status: { $ne: 'cancelled' },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
            },
          },
          totalSales: {
            $sum: {
              $cond: [{ $eq: ['$isPaid', true] }, '$totalPrice', 0],
            },
          },
          bookingCount: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Create a complete array for the last 30 days (including days with no data)
    const data: SalesData[] = [];

    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];

      // Find data for this date
      const dayData = salesData.find(item => item._id === dateString);

      data.push({
        date: date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        fullDate: dateString,
        sales: dayData?.totalSales || 0,
        bookings: dayData?.bookingCount || 0,
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch sales data' },
      { status: 500 }
    );
  }
}
