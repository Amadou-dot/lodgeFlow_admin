import {
  createErrorResponse,
  createSuccessResponse,
  HTTP_STATUS,
  requireApiAuth,
} from '@/lib/api-utils';
import connectDB from '@/lib/mongodb';
import { Dining } from '../../../../models';

export async function GET() {
  const authResult = await requireApiAuth();
  if (!authResult.authenticated) return authResult.error;

  try {
    await connectDB();

    const [result] = await Dining.aggregate([
      {
        $group: {
          _id: null,
          totalItems: { $sum: 1 },
          menuCount: { $sum: { $cond: [{ $eq: ['$type', 'menu'] }, 1, 0] } },
          experienceCount: {
            $sum: { $cond: [{ $eq: ['$type', 'experience'] }, 1, 0] },
          },
          averagePrice: { $avg: '$price' },
          availableItems: { $sum: { $cond: ['$isAvailable', 1, 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          totalItems: 1,
          menuCount: 1,
          experienceCount: 1,
          averagePrice: { $round: ['$averagePrice', 0] },
          availableItems: 1,
        },
      },
    ]);

    const stats = result || {
      totalItems: 0,
      menuCount: 0,
      experienceCount: 0,
      averagePrice: 0,
      availableItems: 0,
    };

    return createSuccessResponse(stats);
  } catch (error) {
    console.error('Error fetching dining stats:', error);
    return createErrorResponse(
      'Failed to fetch dining stats',
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
