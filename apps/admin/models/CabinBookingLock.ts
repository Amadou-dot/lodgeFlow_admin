import mongoose, { Document, Schema } from 'mongoose';

/**
 * Shape of a lock document. Exported for documentation and for tests that
 * deliberately inspect raw lock state; the model itself is *not* exported
 * (see the note on `CabinBookingLock` below).
 */
export interface ICabinBookingLock extends Document {
  cabin: mongoose.Types.ObjectId;
  token: string;
  expiresAt: Date;
}

const CabinBookingLockSchema: Schema = new Schema(
  {
    cabin: {
      type: Schema.Types.ObjectId,
      ref: 'Cabin',
      required: true,
      unique: true,
    },
    token: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: false,
  }
);

// Backstop cleanup for orphaned locks (e.g. a cabin that's later deleted
// while its lock document lingers). The lock's own acquire logic already
// reclaims expired locks on the next contended request for that cabin;
// this just guarantees eventual cleanup even if no such request ever
// comes, mirroring the ProcessedStripeEvent TTL pattern.
CabinBookingLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Module-private on purpose. This is the one Mongoose model in the repo
// that must never be reachable as raw CRUD: a stray `.create()`,
// `.deleteOne()`, or `.findOneAndUpdate()` from a route or script would
// silently corrupt the mutex (delete another holder's live lock, or
// insert a document whose `expiresAt` math doesn't match the TTL the
// acquire loop assumes). Everything callers may legitimately do is
// expressed by the two methods exported below, so the raw model is
// unreachable outside this module at the type level rather than by
// convention (issue #126).
const CabinBookingLockModel =
  mongoose.models.CabinBookingLock ||
  mongoose.model<ICabinBookingLock>('CabinBookingLock', CabinBookingLockSchema);

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  );
}

/**
 * The per-cabin booking mutex's storage protocol: the two atomic
 * primitives that back `withCabinBookingLock()` (`lib/cabin-booking-lock.ts`).
 * The retry loop, TTL budget, and timeout semantics live there; this
 * module owns only the fencing-token contract and the document shape.
 */
const CabinBookingLock = {
  /**
   * Atomically take the lock for `cabin`, stamping it with `token` and an
   * expiry `ttlMs` in the future. Resolves `true` when the lock is held by
   * this caller — either because no document existed or because the
   * existing one had already expired and was reclaimed in place.
   *
   * Resolves `false` when a live (non-expired) holder already owns the
   * lock: the filter matches nothing, so Mongo attempts an upsert *insert*
   * instead, which collides with the unique index on `cabin` and throws
   * E11000. That collision is the contention signal, not an error — every
   * other failure is rethrown.
   */
  async acquire(
    cabin: mongoose.Types.ObjectId,
    token: string,
    ttlMs: number
  ): Promise<boolean> {
    const now = new Date();
    try {
      await CabinBookingLockModel.findOneAndUpdate(
        { cabin, expiresAt: { $lt: now } },
        { $set: { token, expiresAt: new Date(now.getTime() + ttlMs) } },
        { upsert: true, runValidators: true }
      );
      return true;
    } catch (error) {
      if (isDuplicateKeyError(error)) return false;
      throw error;
    }
  },

  /**
   * Release `cabin`'s lock, but only if `token` still matches — the
   * fencing token. A holder that overran its TTL and was reclaimed by
   * another request no longer matches, so its late release deletes
   * nothing instead of freeing the new holder's lock.
   */
  async release(cabin: mongoose.Types.ObjectId, token: string): Promise<void> {
    await CabinBookingLockModel.deleteOne({ cabin, token });
  },
};

export default CabinBookingLock;
