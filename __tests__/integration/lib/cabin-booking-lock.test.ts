import mongoose from 'mongoose';

import { withCabinBookingLock } from '@/lib/cabin-booking-lock';
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
});
