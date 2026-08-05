import {
  createErrorResponse,
  createSuccessResponse,
  HTTP_STATUS,
  requireApiAuth,
} from '@/lib/api-utils';
import connectDB from '@/lib/mongodb';
import { Cabin } from '../../../../models';

export async function GET() {
  const authResult = await requireApiAuth();
  if (!authResult.authenticated) return authResult.error;

  try {
    await connectDB();

    const [result] = await Cabin.aggregate([
      {
        $group: {
          _id: null,
          totalCabins: { $sum: 1 },
          totalCapacity: { $sum: '$capacity' },
          averagePrice: { $avg: '$price' },
          cabinsWithDiscount: {
            $sum: { $cond: [{ $gt: ['$discount', 0] }, 1, 0] },
          },
          activeCabins: {
            $sum: {
              $cond: [{ $eq: ['$status', 'active'] }, 1, 0],
            },
          },
          maintenanceCabins: {
            $sum: {
              $cond: [{ $eq: ['$status', 'maintenance'] }, 1, 0],
            },
          },
          inactiveCabins: {
            $sum: {
              $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalCabins: 1,
          totalCapacity: 1,
          averagePrice: { $round: ['$averagePrice', 0] },
          cabinsWithDiscount: 1,
          activeCabins: 1,
          maintenanceCabins: 1,
          inactiveCabins: 1,
        },
      },
    ]);

    const stats = result || {
      totalCabins: 0,
      totalCapacity: 0,
      averagePrice: 0,
      cabinsWithDiscount: 0,
      activeCabins: 0,
      maintenanceCabins: 0,
      inactiveCabins: 0,
    };

    return createSuccessResponse(stats);
  } catch (error) {
    console.error('Error fetching cabin stats:', error);
    return createErrorResponse(
      'Failed to fetch cabin stats',
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
