jest.mock('@lodgeflow/database/mongodb', () =>
  jest.fn().mockResolvedValue(undefined)
);
import { replaceDemoData } from '@/lib/seed-database';
import {
  Booking,
  Cabin,
  Dining,
  DiningReservation,
  ExperienceBooking,
  Settings,
} from '@lodgeflow/database';

describe('transactional demo reset', () => {
  it('replaces reservations and related catalogs with valid receipts and references', async () => {
    await DiningReservation.collection.insertOne({
      customer: 'obsolete',
      dining: 'obsolete',
    });
    await ExperienceBooking.collection.insertOne({
      customer: 'obsolete',
      experience: 'obsolete',
    });
    const result = await replaceDemoData(['demo-customer']);
    expect(result.bookings).toBe(500);
    expect(await Booking.countDocuments()).toBe(500);
    expect(await DiningReservation.countDocuments()).toBe(0);
    expect(await ExperienceBooking.countDocuments()).toBe(0);
    const cabins = await Cabin.find().distinct('_id');
    expect(await Booking.countDocuments({ cabin: { $nin: cabins } })).toBe(0);
    const unpaid = await Booking.findOne({
      isPaid: false,
      status: { $ne: 'cancelled' },
    });
    expect(unpaid!.remainingAmount).toBe(
      unpaid!.totalPrice - unpaid!.amountPaid
    );
  });

  it('rolls back deletions when inserting the replacement data fails', async () => {
    const original = await Settings.create({
      propertyName: 'Keep this setting',
    });
    const failure = jest
      .spyOn(Dining, 'insertMany')
      .mockRejectedValueOnce(new Error('Simulated write failure'));
    try {
      await expect(replaceDemoData(['demo-customer'])).rejects.toThrow(
        'Simulated write failure'
      );
      expect(String((await Settings.findOne())?._id)).toBe(
        String(original._id)
      );
      expect(await Cabin.countDocuments()).toBe(0);
      expect(await Booking.countDocuments()).toBe(0);
    } finally {
      failure.mockRestore();
    }
  });
});
