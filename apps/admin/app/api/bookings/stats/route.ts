import {
  createErrorResponse,
  createSuccessResponse,
  HTTP_STATUS,
  requireApiAuth,
} from '@/lib/api-utils';
import connectDB from '@/lib/mongodb';
import { Booking } from '../../../../models';

export async function GET() {
  const authResult = await requireApiAuth();
  if (!authResult.authenticated) return authResult.error;

  try {
    await connectDB();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [result] = await Booking.aggregate([
      {
        $facet: {
          todayCheckIns: [
            {
              $match: {
                checkInDate: { $gte: todayStart, $lte: todayEnd },
                status: { $ne: 'cancelled' },
              },
            },
            { $count: 'count' },
          ],
          todayCheckOuts: [
            {
              $match: {
                checkOutDate: { $gte: todayStart, $lte: todayEnd },
                status: { $ne: 'cancelled' },
              },
            },
            { $count: 'count' },
          ],
          checkedIn: [
            { $match: { status: 'checked-in' } },
            { $count: 'count' },
          ],
          unconfirmed: [
            { $match: { status: 'unconfirmed' } },
            { $count: 'count' },
          ],
        },
      },
    ]);

    const stats = {
      todayCheckIns: result.todayCheckIns[0]?.count || 0,
      todayCheckOuts: result.todayCheckOuts[0]?.count || 0,
      checkedIn: result.checkedIn[0]?.count || 0,
      unconfirmed: result.unconfirmed[0]?.count || 0,
    };

    return createSuccessResponse(stats);
  } catch (error) {
    console.error('Error fetching booking stats:', error);
    return createErrorResponse(
      'Failed to fetch booking stats',
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
