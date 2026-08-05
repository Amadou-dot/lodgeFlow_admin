import { cache } from 'react';

import { Cabin, connectDB } from '@/models';
import type { Cabin as CabinType } from '@/types';

/**
 * Fetch a single active cabin by id. Wrapped in React cache() so the page
 * component and generateMetadata share one DB round-trip per request.
 *
 * Returns a fully-serialized plain object (ObjectId -> string, virtuals
 * included) so it can cross the RSC -> Client Component boundary as a prop.
 */
export const getCabinById = cache(
  async (id: string): Promise<CabinType | null> => {
    if (!id || typeof id !== 'string') return null;
    try {
      await connectDB();
      const doc = await Cabin.findById(id);
      if (!doc) return null;
      // JSON.parse(JSON.stringify(...)) preserves virtuals (toJSON: { virtuals: true })
      // and converts ObjectId to string. .lean() would skip virtuals.
      return JSON.parse(JSON.stringify(doc));
    } catch (error) {
      console.error(`getCabinById(${id}): failed`, error);
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
      return JSON.parse(JSON.stringify(docs));
    } catch (error) {
      console.error('getAllActiveCabinsForListing: failed', error);
      return [];
    }
  }
);
