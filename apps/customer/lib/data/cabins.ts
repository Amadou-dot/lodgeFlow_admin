import { cache } from 'react';

import { Cabin, connectDB } from '@lodgeflow/database';
import { logger } from '@lodgeflow/database/logger';
import type { Cabin as CabinType } from '@/types';
import { serializeCabinDetail } from '@lodgeflow/database/cabin-json';
import { cabinIdSchema } from '@/lib/validations/cabin';

/**
 * Fetch a single active cabin by id. Wrapped in React cache() so the page
 * component and generateMetadata share one DB round-trip per request.
 *
 * Returns a fully-serialized plain object (ObjectId -> string, virtuals
 * included) so it can cross the RSC -> Client Component boundary as a prop.
 */
export const getCabinById = cache(
  async (id: string): Promise<CabinType | null> => {
    const input = cabinIdSchema.safeParse(id);
    if (!input.success) return null;
    try {
      await connectDB();
      const doc = await Cabin.findById(input.data);
      if (!doc || (doc.status && doc.status !== 'active')) return null;
      return serializeCabinDetail(doc);
    } catch (error) {
      logger.error('getCabinById: failed', error, { cabinId: input.data });
      return null;
    }
  }
);

/**
 * Fetch all active cabins for the listing page. Sorted by price ascending
 * to match the client-side default. Wrapped in cache() for request-scoped
 * deduplication.
 */
export const getAllActiveCabinsForListing = cache(
  async (): Promise<CabinType[]> => {
    try {
      await connectDB();
      const docs = await Cabin.find({ status: 'active' }).sort({ price: 1 });
      return docs.map(serializeCabinDetail);
    } catch (error) {
      logger.error('getAllActiveCabinsForListing: failed', error);
      return [];
    }
  }
);
