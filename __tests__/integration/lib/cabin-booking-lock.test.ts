import mongoose from 'mongoose';

import {
  CabinBookingLockTimeoutError,
  withCabinBookingLock,
} from '@/lib/cabin-booking-lock';
import CabinBookingLock from '@/models/CabinBookingLock';

describe('withCabinBookingLock', () => {
  const cabinId = new mongoose.Types.ObjectId();

  it('runs the callback and returns its result', async () => {
    const result = await withCabinBookingLock(cabinId, async () => 'done');
    expect(result).toBe('done');
  });

  it('releases the lock after the callback resolves', async () => {
    await withCabinBookingLock(cabinId, async () => 'done');
    const remaining = await CabinBookingLock.findOne({ cabin: cabinId });
    expect(remaining).toBeNull();
  });

  it('releases the lock after the callback throws', async () => {
    await expect(
      withCabinBookingLock(cabinId, async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');

    const remaining = await CabinBookingLock.findOne({ cabin: cabinId });
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
    await CabinBookingLock.create({
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
    await CabinBookingLock.create({
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
      .spyOn(CabinBookingLock, 'deleteOne')
      .mockRejectedValueOnce(new Error('transient release failure'));

    const result = await withCabinBookingLock(cabinId, async () => 'done');

    expect(result).toBe('done');
    releaseSpy.mockRestore();
  });

  it('does not mask the original error when releasing the lock also fails', async () => {
    const releaseSpy = jest
      .spyOn(CabinBookingLock, 'deleteOne')
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
});
