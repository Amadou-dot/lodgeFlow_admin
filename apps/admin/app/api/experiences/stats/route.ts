import {
  createErrorResponse,
  createSuccessResponse,
  HTTP_STATUS,
  requireApiAuth,
} from '@/lib/api-utils';
import connectDB from '@/lib/mongodb';
import { Experience } from '../../../../models';

export async function GET() {
  const authResult = await requireApiAuth();
  if (!authResult.authenticated) return authResult.error;

  try {
    await connectDB();

    const [result] = await Experience.aggregate([
      {
        $group: {
          _id: null,
          totalExperiences: { $sum: 1 },
          averagePrice: { $avg: '$price' },
          popularCount: { $sum: { $cond: ['$isPopular', 1, 0] } },
          totalCapacity: { $sum: { $ifNull: ['$maxParticipants', 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          totalExperiences: 1,
          averagePrice: { $round: ['$averagePrice', 0] },
          popularCount: 1,
          totalCapacity: 1,
        },
      },
    ]);

    const stats = result || {
      totalExperiences: 0,
      averagePrice: 0,
      popularCount: 0,
      totalCapacity: 0,
    };

    return createSuccessResponse(stats);
  } catch (error) {
    console.error('Error fetching experience stats:', error);
    return createErrorResponse(
      'Failed to fetch experience stats',
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
