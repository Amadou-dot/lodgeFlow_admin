import mongoose from 'mongoose';
import Booking from '@/models/Booking';
import Cabin from '@/models/Cabin';

// Helper to create a valid cabin in the DB
async function createTestCabin(overrides: Record<string, any> = {}) {
  return Cabin.create({
    name: 'Test Cabin',
    description: 'A test cabin for booking tests',
    capacity: 4,
    price: 200,
    discount: 0,
    image: 'https://example.com/cabin.jpg',
    amenities: ['WiFi'],
    status: 'active',
    ...overrides,
  });
}

// Helper to create a valid booking input
function createBookingData(
  cabinId: mongoose.Types.ObjectId,
  overrides: Record<string, any> = {}
) {
  const checkIn = new Date('2027-06-01');
  const checkOut = new Date('2027-06-04');
  return {
    cabin: cabinId,
    customer: 'user_test123',
    checkInDate: checkIn,
    checkOutDate: checkOut,
    numNights: 3,
    numGuests: 2,
    cabinPrice: 600,
    totalPrice: 600,
    ...overrides,
  };
}

describe('Booking Model', () => {
  describe('Document Creation', () => {
    it('creates a booking with valid data', async () => {
      const cabin = await createTestCabin();
      const booking = await Booking.create(createBookingData(cabin._id));

      expect(booking._id).toBeDefined();
      expect(booking.customer).toBe('user_test123');
      expect(booking.status).toBe('unconfirmed');
      expect(booking.isPaid).toBe(false);
    });

    it('sets default values correctly', async () => {
      const cabin = await createTestCabin();
      const booking = await Booking.create(createBookingData(cabin._id));

      expect(booking.status).toBe('unconfirmed');
      expect(booking.isPaid).toBe(false);
      expect(booking.depositPaid).toBe(false);
      expect(booking.depositAmount).toBe(0);
      expect(booking.extrasPrice).toBe(0);
      expect(booking.paymentMethod).toBe('online');
      expect(booking.refundStatus).toBe('none');
      expect(booking.extras.hasBreakfast).toBe(false);
      expect(booking.extras.hasPets).toBe(false);
    });

    it('supports synchronized metadata fields', async () => {
      const cabin = await createTestCabin();
      const paidAt = new Date('2027-06-02T10:00:00.000Z');
      const booking = await Booking.create(
        createBookingData(cabin._id, {
          stripePaymentIntentId: 'pi_test_123',
          stripeSessionId: 'cs_test_123',
          paidAt,
          cancellationReason: 'Guest changed plans',
          refundStatus: 'pending',
        })
      );

      expect(booking.stripePaymentIntentId).toBe('pi_test_123');
      expect(booking.stripeSessionId).toBe('cs_test_123');
      expect(booking.paidAt).toEqual(paidAt);
      expect(booking.cancellationReason).toBe('Guest changed plans');
      expect(booking.refundStatus).toBe('pending');
    });

    it('requires cabin field', async () => {
      await expect(
        Booking.create({
          customer: 'user_test',
          checkInDate: new Date('2027-06-01'),
          checkOutDate: new Date('2027-06-04'),
          numNights: 3,
          numGuests: 2,
          cabinPrice: 600,
          totalPrice: 600,
        })
      ).rejects.toThrow(/Cabin is required/);
    });

    it('requires customer field', async () => {
      const cabin = await createTestCabin();
      await expect(
        Booking.create({
          cabin: cabin._id,
          checkInDate: new Date('2027-06-01'),
          checkOutDate: new Date('2027-06-04'),
          numNights: 3,
          numGuests: 2,
          cabinPrice: 600,
          totalPrice: 600,
        })
      ).rejects.toThrow(/Customer is required/);
    });

    it('validates status enum', async () => {
      const cabin = await createTestCabin();
      await expect(
        Booking.create(createBookingData(cabin._id, { status: 'invalid' }))
      ).rejects.toThrow();
    });

    it('validates checkOutDate is after checkInDate', async () => {
      const cabin = await createTestCabin();
      await expect(
        Booking.create(
          createBookingData(cabin._id, {
            checkInDate: new Date('2027-06-05'),
            checkOutDate: new Date('2027-06-01'),
          })
        )
      ).rejects.toThrow(/Check-out date must be after check-in date/);
    });

    it('validates numGuests minimum', async () => {
      const cabin = await createTestCabin();
      await expect(
        Booking.create(createBookingData(cabin._id, { numGuests: 0 }))
      ).rejects.toThrow(/Number of guests must be at least 1/);
    });

    it('validates observations max length', async () => {
      const cabin = await createTestCabin();
      const longObs = 'a'.repeat(1001);
      await expect(
        Booking.create(createBookingData(cabin._id, { observations: longObs }))
      ).rejects.toThrow(/Observations cannot exceed 1000 characters/);
    });
  });

  describe('Pre-save Middleware', () => {
    it('auto-calculates numNights from dates', async () => {
      const cabin = await createTestCabin();
      const booking = new Booking(
        createBookingData(cabin._id, {
          checkInDate: new Date('2027-06-01'),
          checkOutDate: new Date('2027-06-05'),
          numNights: 1, // intentionally wrong
        })
      );
      await booking.save();

      expect(booking.numNights).toBe(4);
    });

    it('auto-calculates remainingAmount', async () => {
      const cabin = await createTestCabin();
      const booking = new Booking(
        createBookingData(cabin._id, {
          totalPrice: 1000,
          depositAmount: 250,
        })
      );
      await booking.save();

      expect(booking.remainingAmount).toBe(750);
    });

    it('remainingAmount equals totalPrice when no deposit', async () => {
      const cabin = await createTestCabin();
      const booking = new Booking(
        createBookingData(cabin._id, {
          totalPrice: 500,
          depositAmount: 0,
        })
      );
      await booking.save();

      expect(booking.remainingAmount).toBe(500);
    });
  });

  describe('findOverlapping static', () => {
    it('detects overlapping bookings for same cabin', async () => {
      const cabin = await createTestCabin();

      // Create existing booking: Jun 1-5
      const created = await Booking.create(
        createBookingData(cabin._id, {
          checkInDate: new Date('2027-06-01'),
          checkOutDate: new Date('2027-06-05'),
          numNights: 4,
        })
      );

      // Verify booking was created
      const count = await Booking.countDocuments();
      expect(count).toBe(1);

      // Check for overlap: Jun 3-7 (overlaps with Jun 1-5)
      // Use the cabin ObjectId directly from the created booking
      const overlapping = await Booking.findOverlapping(
        created.cabin,
        new Date('2027-06-03'),
        new Date('2027-06-07')
      );

      expect(overlapping.length).toBe(1);
    });

    it('does not detect non-overlapping bookings', async () => {
      const cabin = await createTestCabin();

      // Create existing booking: Jun 1-5
      await Booking.create(
        createBookingData(cabin._id, {
          checkInDate: new Date('2027-06-01'),
          checkOutDate: new Date('2027-06-05'),
          numNights: 4,
        })
      );

      // Check for overlap: Jun 10-15 (no overlap)
      const overlapping = await Booking.findOverlapping(
        cabin._id,
        new Date('2027-06-10'),
        new Date('2027-06-15')
      );

      expect(overlapping.length).toBe(0);
    });

    it('excludes self when excludeBookingId provided', async () => {
      const cabin = await createTestCabin();

      const booking = await Booking.create(
        createBookingData(cabin._id, {
          checkInDate: new Date('2027-06-01'),
          checkOutDate: new Date('2027-06-05'),
          numNights: 4,
        })
      );

      // Check overlap with the same dates, excluding self
      const overlapping = await Booking.findOverlapping(
        cabin._id,
        new Date('2027-06-01'),
        new Date('2027-06-05'),
        new mongoose.Types.ObjectId(booking._id.toString())
      );

      expect(overlapping.length).toBe(0);
    });

    it('excludes cancelled bookings from overlap check', async () => {
      const cabin = await createTestCabin();

      // Create a cancelled booking: Jun 1-5
      await Booking.create(
        createBookingData(cabin._id, {
          checkInDate: new Date('2027-06-01'),
          checkOutDate: new Date('2027-06-05'),
          numNights: 4,
          status: 'cancelled',
        })
      );

      // Check overlap: Jun 3-7 (should not detect cancelled)
      const overlapping = await Booking.findOverlapping(
        cabin._id,
        new Date('2027-06-03'),
        new Date('2027-06-07')
      );

      expect(overlapping.length).toBe(0);
    });

    it('only checks overlaps for the same cabin', async () => {
      const cabin1 = await createTestCabin({ name: 'Cabin 1' });
      const cabin2 = await createTestCabin({ name: 'Cabin 2' });

      // Create booking for cabin1: Jun 1-5
      await Booking.create(
        createBookingData(cabin1._id, {
          checkInDate: new Date('2027-06-01'),
          checkOutDate: new Date('2027-06-05'),
          numNights: 4,
        })
      );

      // Check overlap for cabin2: Jun 3-7 (different cabin, no overlap)
      const overlapping = await Booking.findOverlapping(
        cabin2._id,
        new Date('2027-06-03'),
        new Date('2027-06-07')
      );

      expect(overlapping.length).toBe(0);
    });
  });

  describe('Virtuals', () => {
    it('durationText returns correct singular form', async () => {
      const cabin = await createTestCabin();
      const booking = await Booking.create(
        createBookingData(cabin._id, {
          checkInDate: new Date('2027-06-01'),
          checkOutDate: new Date('2027-06-02'),
          numNights: 1,
        })
      );
      const json = booking.toJSON();

      expect(json.durationText).toBe('1 night');
    });

    it('durationText returns correct plural form', async () => {
      const cabin = await createTestCabin();
      const booking = await Booking.create(createBookingData(cabin._id));
      const json = booking.toJSON();

      expect(json.durationText).toBe('3 nights');
    });

    it('paymentStatus returns "paid" when isPaid', async () => {
      const cabin = await createTestCabin();
      const booking = await Booking.create(
        createBookingData(cabin._id, { isPaid: true })
      );
      const json = booking.toJSON();

      expect(json.paymentStatus).toBe('paid');
    });

    it('paymentStatus returns "partial" when deposit paid', async () => {
      const cabin = await createTestCabin();
      const booking = await Booking.create(
        createBookingData(cabin._id, {
          isPaid: false,
          depositPaid: true,
        })
      );
      const json = booking.toJSON();

      expect(json.paymentStatus).toBe('partial');
    });

    it('paymentStatus returns "unpaid" when nothing paid', async () => {
      const cabin = await createTestCabin();
      const booking = await Booking.create(createBookingData(cabin._id));
      const json = booking.toJSON();

      expect(json.paymentStatus).toBe('unpaid');
    });
  });

  describe('Indexes', () => {
    it('has compound index on cabin+checkInDate+checkOutDate', async () => {
      const indexes = await Booking.collection.indexes();
      const compoundIndex = indexes.find(
        (idx: any) =>
          idx.key.cabin === 1 &&
          idx.key.checkInDate === 1 &&
          idx.key.checkOutDate === 1
      );
      expect(compoundIndex).toBeDefined();
    });

    it('has index on status', async () => {
      const indexes = await Booking.collection.indexes();
      const statusIndex = indexes.find((idx: any) => idx.key.status === 1);
      expect(statusIndex).toBeDefined();
    });
  });
});
