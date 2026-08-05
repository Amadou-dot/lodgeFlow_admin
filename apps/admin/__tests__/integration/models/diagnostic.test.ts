import mongoose from 'mongoose';
import Booking from '@/models/Booking';
import Cabin from '@/models/Cabin';

describe('Diagnostic', () => {
  it('checks mongoose connection state', () => {
    console.log('Mongoose readyState:', mongoose.connection.readyState);
    console.log('Mongoose connection name:', mongoose.connection.name);
    console.log('Models registered:', Object.keys(mongoose.models));
  });

  it('can create and find a cabin', async () => {
    const cabin = await Cabin.create({
      name: 'Diag Cabin',
      description: 'Test',
      capacity: 2,
      price: 100,
      discount: 0,
      image: 'https://example.com/img.jpg',
    });
    console.log('Cabin created:', cabin._id);

    const count = await Cabin.countDocuments();
    console.log('Cabin count:', count);
    expect(count).toBe(1);

    const found = await Cabin.findById(cabin._id);
    console.log('Cabin found:', found?._id);
    expect(found).not.toBeNull();
  });

  it('can create and find a booking', async () => {
    const cabin = await Cabin.create({
      name: 'Booking Cabin',
      description: 'Test',
      capacity: 2,
      price: 100,
      discount: 0,
      image: 'https://example.com/img.jpg',
    });

    const booking = await Booking.create({
      cabin: cabin._id,
      customer: 'user_test',
      checkInDate: new Date('2027-06-01'),
      checkOutDate: new Date('2027-06-04'),
      numNights: 3,
      numGuests: 2,
      cabinPrice: 300,
      totalPrice: 300,
    });
    console.log('Booking created:', booking._id);

    const count = await Booking.countDocuments();
    console.log('Booking count:', count);
    expect(count).toBe(1);
  });
});
