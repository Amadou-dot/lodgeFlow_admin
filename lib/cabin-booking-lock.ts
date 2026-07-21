import crypto from 'crypto';
import mongoose from 'mongoose';

import CabinBookingLock from '@/models/CabinBookingLock';

// How long a lock is held before it's considered stale and can be
// reclaimed by another request (e.g. the holder crashed mid-request).
const LOCK_TTL_MS = 10_000;
// How long to wait, in total, for a currently-held lock to free up
// before giving up. Legitimate contention (two real concurrent booking
// requests) resolves in well under a second; this budget only matters
// when something is stuck.
const ACQUIRE_RETRY_DELAY_MS = 50;
const ACQUIRE_MAX_ATTEMPTS = 60; // ~3s worst case

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Serializes booking create/update requests for a single cabin so the
 * "check for overlap, then write" critical section in
 * `app/api/bookings/route.ts` can't race across concurrent requests
 * (see issue #110). Backed by an atomic upsert against a unique index on
 * `CabinBookingLock.cabin`, not a MongoDB transaction — two transactions
 * each inserting a *different* document don't conflict under MongoDB's
 * transaction semantics, so a transaction alone wouldn't close this race.
 */
export async function withCabinBookingLock<T>(
  cabinId: mongoose.Types.ObjectId | string,
  fn: () => Promise<T>
): Promise<T> {
  const cabinObjectId = new mongoose.Types.ObjectId(cabinId.toString());
  const token = crypto.randomUUID();
  let acquired = false;

  for (let attempt = 0; attempt < ACQUIRE_MAX_ATTEMPTS; attempt++) {
    const now = new Date();
    try {
      // Matches only when no lock exists yet for this cabin, or the
      // existing lock has expired — otherwise this update matches
      // nothing and Mongo attempts an upsert insert, which collides
      // with the unique index on `cabin` and throws E11000.
      await CabinBookingLock.findOneAndUpdate(
        { cabin: cabinObjectId, expiresAt: { $lt: now } },
        { $set: { token, expiresAt: new Date(now.getTime() + LOCK_TTL_MS) } },
        { upsert: true }
      );
      acquired = true;
      break;
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      await sleep(ACQUIRE_RETRY_DELAY_MS);
    }
  }

  if (!acquired) {
    throw new Error(
      `Timed out waiting for booking lock on cabin ${cabinObjectId.toString()}`
    );
  }

  try {
    return await fn();
  } finally {
    // Only release the lock if we still hold it (matches by token) —
    // if our TTL expired and someone else stole it, don't delete theirs.
    await CabinBookingLock.deleteOne({ cabin: cabinObjectId, token });
  }
}
