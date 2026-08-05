import mongoose from 'mongoose';

import {
  CabinBookingLockTimeoutError,
  withCabinBookingLock,
} from '@/lib/cabin-booking-lock';
import CabinBookingLock, {
  type ICabinBookingLock,
} from '@/models/CabinBookingLock';

// `models/CabinBookingLock.ts` keeps its Mongoose model private so no
// caller can bypass the acquire/release protocol (issue #126). These
// tests need to plant and inspect raw lock documents, so they reach the
// model through Mongoose's registry — a deliberate, visible escape hatch
// that production code has no reason to reproduce.
const CabinBookingLockModel =
  mongoose.model<ICabinBookingLock>('CabinBookingLock');

describe('withCabinBookingLock', () => {
  const cabinId = new mongoose.Types.ObjectId();

  it('runs the callback and returns its result', async () => {
    const result = await withCabinBookingLock(cabinId, async () => 'done');
    expect(result).toBe('done');
  });

  it('releases the lock after the callback resolves', async () => {
    await withCabinBookingLock(cabinId, async () => 'done');
    const remaining = await CabinBookingLockModel.findOne({ cabin: cabinId });
    expect(remaining).toBeNull();
  });

  it('releases the lock after the callback throws', async () => {
    await expect(
      withCabinBookingLock(cabinId, async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');

    const remaining = await CabinBookingLockModel.findOne({ cabin: cabinId });
    expect(remaining).toBeNull();
  });

  it('serializes two concurrent callbacks for the same cabin', async () => {
    const order: string[] = [];

    const first = withCabinBookingLock(cabinId, async () => {
      order.push('first-start');
      await new Promise(resolve => setTimeout(resolve, 50));
      order.push('first-end');
    });

    // Give `first` a chance to acquire the lock before `second` tries.
    await new Promise(resolve => setTimeout(resolve, 5));

    const second = withCabinBookingLock(cabinId, async () => {
      order.push('second-start');
    });

    await Promise.all([first, second]);

    expect(order).toEqual(['first-start', 'first-end', 'second-start']);
  });

  it('reclaims a stale (expired) lock instead of waiting out the full TTL', async () => {
    // Simulate a crashed holder: a lock doc whose expiresAt is already
    // in the past.
    await CabinBookingLockModel.create({
      cabin: cabinId,
      token: 'stale-token',
      expiresAt: new Date(Date.now() - 1000),
    });

    const start = Date.now();
    const result = await withCabinBookingLock(cabinId, async () => 'reclaimed');
    const elapsedMs = Date.now() - start;

    expect(result).toBe('reclaimed');
    // Should acquire on the first attempt, not after retrying for seconds.
    expect(elapsedMs).toBeLessThan(500);
  });

  it('does not serialize callbacks for different cabins', async () => {
    const cabinA = new mongoose.Types.ObjectId();
    const cabinB = new mongoose.Types.ObjectId();
    const order: string[] = [];

    const lockA = withCabinBookingLock(cabinA, async () => {
      order.push('a-start');
      await new Promise(resolve => setTimeout(resolve, 100));
      order.push('a-end');
    });

    // Give A a chance to acquire its (unrelated) lock first.
    await new Promise(resolve => setTimeout(resolve, 20));

    const lockB = withCabinBookingLock(cabinB, async () => {
      order.push('b-start');
      order.push('b-end');
    });

    await Promise.all([lockA, lockB]);

    // B must not have to wait for A's unrelated lock to release.
    expect(order.indexOf('b-start')).toBeLessThan(order.indexOf('a-end'));
  });

  it('lets only one of two concurrent reclaimers win the same stale lock', async () => {
    await CabinBookingLockModel.create({
      cabin: cabinId,
      token: 'stale-token',
      expiresAt: new Date(Date.now() - 1000),
    });

    const order: string[] = [];
    const runs = ['first', 'second'].map(label =>
      withCabinBookingLock(cabinId, async () => {
        order.push(`${label}-start`);
        await new Promise(resolve => setTimeout(resolve, 50));
        order.push(`${label}-end`);
      })
    );

    await Promise.all(runs);

    // Whichever reclaims first must fully finish before the other starts
    // — never interleaved, even though both raced the same expired doc.
    expect(order).toEqual(
      order[0] === 'first-start'
        ? ['first-start', 'first-end', 'second-start', 'second-end']
        : ['second-start', 'second-end', 'first-start', 'first-end']
    );
  });

  it('does not mask a successful result when releasing the lock fails', async () => {
    const releaseSpy = jest
      .spyOn(CabinBookingLock, 'release')
      .mockRejectedValueOnce(new Error('transient release failure'));

    const result = await withCabinBookingLock(cabinId, async () => 'done');

    expect(result).toBe('done');
    releaseSpy.mockRestore();
  });

  it('does not mask the original error when releasing the lock also fails', async () => {
    const releaseSpy = jest
      .spyOn(CabinBookingLock, 'release')
      .mockRejectedValueOnce(new Error('transient release failure'));

    await expect(
      withCabinBookingLock(cabinId, async () => {
        throw new Error('original failure');
      })
    ).rejects.toThrow('original failure');

    releaseSpy.mockRestore();
  });

  it('CabinBookingLockTimeoutError carries the cabin id in its message', () => {
    const error = new CabinBookingLockTimeoutError(cabinId.toString());
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('CabinBookingLockTimeoutError');
    expect(error.message).toContain(cabinId.toString());
  });

  it('gives up and throws CabinBookingLockTimeoutError once the acquire budget is exhausted', async () => {
    jest.useFakeTimers({ advanceTimers: true });
    // A permanently contended lock: every acquire attempt loses the race
    // to a live holder, so the retry budget drains without success.
    const acquireSpy = jest
      .spyOn(CabinBookingLock, 'acquire')
      .mockResolvedValue(false);

    const assertion = expect(
      withCabinBookingLock(cabinId, async () => 'unreachable')
    ).rejects.toThrow(CabinBookingLockTimeoutError);

    // Fast-forward through every retry sleep instead of waiting ~13s.
    await jest.advanceTimersByTimeAsync(20_000);
    await assertion;

    acquireSpy.mockRestore();
    jest.useRealTimers();
  });
});

describe('CabinBookingLock protocol', () => {
  const cabinId = new mongoose.Types.ObjectId();

  // The unique index on `cabin` is what turns a contended acquire into an
  // E11000 collision, so wait for it to finish building before racing it.
  beforeAll(async () => {
    await CabinBookingLockModel.init();
  });

  it('exposes only acquire and release, never raw Mongoose CRUD', () => {
    expect(Object.keys(CabinBookingLock).sort()).toEqual([
      'acquire',
      'release',
    ]);
  });

  it('acquires a free lock and stamps it with the caller token and TTL', async () => {
    const before = Date.now();
    await expect(
      CabinBookingLock.acquire(cabinId, 'token-a', 10_000)
    ).resolves.toBe(true);

    const doc = await CabinBookingLockModel.findOne({ cabin: cabinId });
    expect(doc?.token).toBe('token-a');
    expect(doc?.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 10_000);
  });

  it('refuses to acquire a lock a live holder still owns', async () => {
    await CabinBookingLock.acquire(cabinId, 'token-a', 10_000);

    await expect(
      CabinBookingLock.acquire(cabinId, 'token-b', 10_000)
    ).resolves.toBe(false);

    // The loser must not have disturbed the holder's stamp.
    const doc = await CabinBookingLockModel.findOne({ cabin: cabinId });
    expect(doc?.token).toBe('token-a');
  });

  it('reclaims an expired lock in place', async () => {
    await CabinBookingLockModel.create({
      cabin: cabinId,
      token: 'crashed-holder',
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(
      CabinBookingLock.acquire(cabinId, 'token-b', 10_000)
    ).resolves.toBe(true);

    const doc = await CabinBookingLockModel.findOne({ cabin: cabinId });
    expect(doc?.token).toBe('token-b');
    expect(doc?.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('releases a lock the caller still holds', async () => {
    await CabinBookingLock.acquire(cabinId, 'token-a', 10_000);
    await CabinBookingLock.release(cabinId, 'token-a');

    expect(await CabinBookingLockModel.findOne({ cabin: cabinId })).toBeNull();
  });

  it('ignores a release from a holder whose lock was already reclaimed', async () => {
    // The fencing token: an overran holder's late release must not free
    // the lock its successor now legitimately owns.
    await CabinBookingLock.acquire(cabinId, 'new-holder', 10_000);

    await CabinBookingLock.release(cabinId, 'overran-holder');

    const doc = await CabinBookingLockModel.findOne({ cabin: cabinId });
    expect(doc?.token).toBe('new-holder');
  });

  it('rethrows acquire failures that are not lock contention', async () => {
    const failure = Object.assign(new Error('connection reset'), { code: 6 });
    const spy = jest
      .spyOn(CabinBookingLockModel, 'findOneAndUpdate')
      .mockRejectedValueOnce(failure);

    await expect(
      CabinBookingLock.acquire(cabinId, 'token-a', 10_000)
    ).rejects.toThrow('connection reset');

    spy.mockRestore();
  });
});
