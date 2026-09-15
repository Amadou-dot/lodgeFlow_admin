/**
 * Tests for the backfill-booking-metadata script logic.
 *
 * Since the script runs as a standalone process with process.exit() calls,
 * we test the core backfill logic by replicating its conditions against
 * real MongoDB documents and verifying the expected operations.
 */
import mongoose from 'mongoose';

jest.mock('@/lib/mongodb', () => jest.fn().mockResolvedValue(undefined));

import Booking from '@/models/Booking';
import Cabin from '@/models/Cabin';

async function createTestCabin() {
  return Cabin.create({
    name: 'Backfill Test Cabin',
    description: 'Cabin for backfill tests',
    capacity: 4,
    price: 200,
    discount: 0,
    image: 'https://example.com/cabin.jpg',
    amenities: ['WiFi'],
    status: 'active',
  });
}

/**
 * Replicate the backfill script's core logic.
 * This mirrors the core logic inside backfillBookingMetadata() in
 * scripts/backfill-booking-metadata.ts (from the Booking.find() call
 * through operations construction).
 *
 * Both this helper and the real script use .lean() to bypass Mongoose
 * default hydration, so missing fields are truly undefined rather than
 * filled in by schema defaults.
 */
async function runBackfillLogic() {
  const bookings = await Booking.find(
    {},
    '_id totalPrice depositAmount remainingAmount status cancelledAt updatedAt refundStatus isPaid'
  ).lean();

  let initializedRefundStatus = 0;
  let normalizedRemainingAmount = 0;
  let backfilledCancelledAt = 0;

  const operations = bookings.flatMap(booking => {
    const updates: Record<string, unknown> = {};

    if (!booking.refundStatus) {
      updates.refundStatus = 'none';
      initializedRefundStatus += 1;
    }

    if (!booking.isPaid) {
      const normalizedRemaining = Math.max(
        0,
        booking.totalPrice - (booking.depositAmount ?? 0)
      );
      if (booking.remainingAmount !== normalizedRemaining) {
        updates.remainingAmount = normalizedRemaining;
        normalizedRemainingAmount += 1;
      }
    }

    if (booking.status === 'cancelled' && !booking.cancelledAt) {
      updates.cancelledAt = booking.updatedAt;
      backfilledCancelledAt += 1;
    }

    if (Object.keys(updates).length === 0) {
      return [];
    }

    return [
      {
        updateOne: {
          filter: { _id: booking._id },
          update: { $set: updates },
        },
      },
    ];
  });

  if (operations.length > 0) {
    await Booking.bulkWrite(operations, { ordered: false });
  }

  return {
    scanned: bookings.length,
    operations: operations.length,
    initializedRefundStatus,
    normalizedRemainingAmount,
    backfilledCancelledAt,
  };
}

describe('Backfill Booking Metadata', () => {
  let cabinId: mongoose.Types.ObjectId;

  beforeEach(async () => {
    const cabin = await createTestCabin();
    cabinId = cabin._id;
  });

  it('initializes missing refundStatus to none', async () => {
    // Create booking and unset refundStatus at the raw level
    const booking = await Booking.create({
      cabin: cabinId,
      customer: 'user_test1',
      checkInDate: new Date('2027-06-01'),
      checkOutDate: new Date('2027-06-04'),
      numNights: 3,
      numGuests: 2,
      cabinPrice: 600,
      totalPrice: 600,
    });
    // Unset refundStatus directly to simulate a pre-schema document
    await Booking.updateOne(
      { _id: booking._id },
      { $unset: { refundStatus: 1 } }
    );

    const stats = await runBackfillLogic();

    expect(stats.initializedRefundStatus).toBe(1);
    const updated = await Booking.findById(booking._id);
    expect(updated!.refundStatus).toBe('none');
  });

  it('does not overwrite existing refundStatus', async () => {
    await Booking.create({
      cabin: cabinId,
      customer: 'user_test2',
      checkInDate: new Date('2027-06-01'),
      checkOutDate: new Date('2027-06-04'),
      numNights: 3,
      numGuests: 2,
      cabinPrice: 600,
      totalPrice: 600,
      status: 'cancelled',
      refundStatus: 'pending',
    });

    const stats = await runBackfillLogic();

    expect(stats.initializedRefundStatus).toBe(0);
    const bookings = await Booking.find({});
    expect(bookings[0].refundStatus).toBe('pending');
  });

  it('normalizes remainingAmount for unpaid bookings', async () => {
    const booking = await Booking.create({
      cabin: cabinId,
      customer: 'user_test3',
      checkInDate: new Date('2027-06-01'),
      checkOutDate: new Date('2027-06-04'),
      numNights: 3,
      numGuests: 2,
      cabinPrice: 600,
      totalPrice: 600,
      depositAmount: 200,
      isPaid: false,
    });
    // Force a wrong remainingAmount bypassing pre-save
    await Booking.updateOne(
      { _id: booking._id },
      { $set: { remainingAmount: 999 } }
    );

    const stats = await runBackfillLogic();

    expect(stats.normalizedRemainingAmount).toBe(1);
    const updated = await Booking.findById(booking._id);
    expect(updated!.remainingAmount).toBe(400); // max(0, 600 - 200)
  });

  it('skips remainingAmount normalization for paid bookings', async () => {
    const booking = await Booking.create({
      cabin: cabinId,
      customer: 'user_test4',
      checkInDate: new Date('2027-06-01'),
      checkOutDate: new Date('2027-06-04'),
      numNights: 3,
      numGuests: 2,
      cabinPrice: 600,
      totalPrice: 600,
      depositAmount: 600,
      isPaid: true,
    });
    // Force a "wrong" remainingAmount — should NOT be touched for paid bookings
    await Booking.updateOne(
      { _id: booking._id },
      { $set: { remainingAmount: 999 } }
    );

    const stats = await runBackfillLogic();

    expect(stats.normalizedRemainingAmount).toBe(0);
    const updated = await Booking.findById(booking._id);
    expect(updated!.remainingAmount).toBe(999); // untouched
  });

  it('backfills cancelledAt from updatedAt on cancelled bookings', async () => {
    const booking = await Booking.create({
      cabin: cabinId,
      customer: 'user_test5',
      checkInDate: new Date('2027-06-01'),
      checkOutDate: new Date('2027-06-04'),
      numNights: 3,
      numGuests: 2,
      cabinPrice: 600,
      totalPrice: 600,
      status: 'cancelled',
    });
    // Unset cancelledAt to simulate a pre-schema cancelled booking
    await Booking.updateOne(
      { _id: booking._id },
      { $unset: { cancelledAt: 1 } }
    );

    const stats = await runBackfillLogic();

    expect(stats.backfilledCancelledAt).toBe(1);
    const updated = await Booking.findById(booking._id);
    expect(updated!.cancelledAt).toBeDefined();
    // cancelledAt should be approximately updatedAt
    expect(updated!.cancelledAt!.getTime()).toBeCloseTo(
      updated!.updatedAt!.getTime(),
      -3 // within 1 second
    );
  });

  it('does not backfill cancelledAt on non-cancelled bookings', async () => {
    await Booking.create({
      cabin: cabinId,
      customer: 'user_test6',
      checkInDate: new Date('2027-06-01'),
      checkOutDate: new Date('2027-06-04'),
      numNights: 3,
      numGuests: 2,
      cabinPrice: 600,
      totalPrice: 600,
      status: 'confirmed',
    });

    const stats = await runBackfillLogic();

    expect(stats.backfilledCancelledAt).toBe(0);
  });

  it('produces zero operations on already-backfilled data (idempotency)', async () => {
    // Create a booking that already has all fields correct
    await Booking.create({
      cabin: cabinId,
      customer: 'user_test7',
      checkInDate: new Date('2027-06-01'),
      checkOutDate: new Date('2027-06-04'),
      numNights: 3,
      numGuests: 2,
      cabinPrice: 600,
      totalPrice: 600,
      depositAmount: 200,
      remainingAmount: 400,
      refundStatus: 'none',
      isPaid: false,
    });

    const stats = await runBackfillLogic();

    expect(stats.operations).toBe(0);
    expect(stats.initializedRefundStatus).toBe(0);
    expect(stats.normalizedRemainingAmount).toBe(0);
    expect(stats.backfilledCancelledAt).toBe(0);
  });

  it('handles multiple bookings with mixed conditions', async () => {
    // Booking 1: missing refundStatus
    const b1 = await Booking.create({
      cabin: cabinId,
      customer: 'user_mix1',
      checkInDate: new Date('2027-06-01'),
      checkOutDate: new Date('2027-06-04'),
      numNights: 3,
      numGuests: 2,
      cabinPrice: 600,
      totalPrice: 600,
    });
    await Booking.updateOne({ _id: b1._id }, { $unset: { refundStatus: 1 } });

    // Booking 2: cancelled without cancelledAt
    const b2 = await Booking.create({
      cabin: cabinId,
      customer: 'user_mix2',
      checkInDate: new Date('2027-07-01'),
      checkOutDate: new Date('2027-07-04'),
      numNights: 3,
      numGuests: 2,
      cabinPrice: 600,
      totalPrice: 600,
      status: 'cancelled',
    });
    await Booking.updateOne({ _id: b2._id }, { $unset: { cancelledAt: 1 } });

    // Booking 3: already correct — should produce no operations
    await Booking.create({
      cabin: cabinId,
      customer: 'user_mix3',
      checkInDate: new Date('2027-08-01'),
      checkOutDate: new Date('2027-08-04'),
      numNights: 3,
      numGuests: 2,
      cabinPrice: 600,
      totalPrice: 600,
      depositAmount: 100,
      remainingAmount: 500,
      refundStatus: 'none',
    });

    const stats = await runBackfillLogic();

    expect(stats.scanned).toBe(3);
    expect(stats.operations).toBe(2); // b1 + b2
    expect(stats.initializedRefundStatus).toBe(1);
    expect(stats.backfilledCancelledAt).toBe(1);
  });
});
