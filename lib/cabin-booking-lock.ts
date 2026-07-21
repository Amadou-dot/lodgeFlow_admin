import crypto from 'crypto';
import mongoose from 'mongoose';

import { logger } from '@/lib/logger';
import CabinBookingLock from '@/models/CabinBookingLock';

// How long a lock is held before it's considered stale and can be
// reclaimed by another request (e.g. the holder crashed mid-request).
const LOCK_TTL_MS = 10_000;
// How long to wait, in total, for a currently-held lock to free up before
// giving up. Kept comfortably above LOCK_TTL_MS: a legitimate holder can
// validly hold the lock for the full TTL, and a waiter that gives up
// sooner than that would spuriously fail a request that was never stuck —
// just queued behind a slow-but-valid critical section.
const ACQUIRE_RETRY_DELAY_MS = 50;
const ACQUIRE_MAX_ATTEMPTS = 260; // 13s nominal, above the 10s TTL

/**
 * Thrown when a cabin's lock stays held (by a live or crashed holder)
 * longer than the acquire budget. Callers should treat this as "the
 * cabin is under heavy write contention right now" (a 409/retry signal),
 * not a generic server error.
 */
export class CabinBookingLockTimeoutError extends Error {
  constructor(cabinId: string) {
    super(`Timed out waiting for booking lock on cabin ${cabinId}`);
    this.name = 'CabinBookingLockTimeoutError';
    Object.setPrototypeOf(this, CabinBookingLockTimeoutError.prototype);
  }
}

/** Discriminated result of a locked write that may be rejected by an overlap check. */
export type LockedWriteResult<T> = { ok: true; booking: T } | { ok: false };

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
      // If no lock exists yet for this cabin, or the existing one has
      // expired, this filter matches and the upsert succeeds (as an
      // insert or an in-place update, respectively). If an active,
      // non-expired lock already exists, the filter matches nothing, so
      // Mongo attempts an upsert *insert* instead — which collides with
      // the unique index on `cabin` and throws E11000.
      await CabinBookingLock.findOneAndUpdate(
        { cabin: cabinObjectId, expiresAt: { $lt: now } },
        { $set: { token, expiresAt: new Date(now.getTime() + LOCK_TTL_MS) } },
        { upsert: true, runValidators: true }
      );
      acquired = true;
      break;
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      await sleep(ACQUIRE_RETRY_DELAY_MS);
    }
  }

  if (!acquired) {
    throw new CabinBookingLockTimeoutError(cabinObjectId.toString());
  }

  // Never let a release failure below mask fn()'s real outcome — a lock
  // document a release couldn't delete simply self-heals via its TTL, but
  // silently swapping a successful write (or a specific, meaningful
  // error) for an unrelated release error is far worse than a stray
  // lock document.
  let settled: { ok: true; value: T } | { ok: false; error: unknown };
  try {
    settled = { ok: true, value: await fn() };
  } catch (error) {
    settled = { ok: false, error };
  }

  try {
    await CabinBookingLock.deleteOne({ cabin: cabinObjectId, token });
  } catch (releaseError) {
    logger.warn(
      'Failed to release cabin booking lock (will self-heal via TTL)',
      {
        cabin: cabinObjectId.toString(),
        error:
          releaseError instanceof Error
            ? releaseError.message
            : String(releaseError),
      }
    );
  }

  if (settled.ok) return settled.value;
  throw settled.error;
}
